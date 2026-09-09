import React from 'react';
import { IFormField } from '@webstack/components/UiForm/models/IFormModel';
import IMemberService, {
    IUserStream,
} from '~/src/core/services/MemberService/IMemberService';
import { buildStreamFields, getStreamCompositeKey, StreamFieldsResult } from '../functions/streamFieldBuilders';
import {
    buildPayloadFromFields,
    buildPayloadFromStream,
    extractValue,
} from '../functions/streamPayloadBuilders';
import { getLiveStreams, LiveStreamInfo } from '../functions/streamLiveSummaries';
import { useStreamStatus, StreamStatus } from './useStreamStatus';
import { useAvailableStreamDevices } from './useAvailableStreamDevices';

export type SubmitState = 'idle' | 'saving' | 'success' | 'error';
export type ActionState = 'idle' | 'saving' | 'deleting' | 'error';

interface UseStreamPanelArgs {
    current?: any;
    memberService: IMemberService;
    eventId?: string | null;
    userId?: string | null;
}

interface UseStreamPanelResult {
    provider: string;
    basicFields: IFormField[];
    advancedFields: IFormField[];
    formFields: IFormField[];
    userStreams: Record<string, IUserStream>;
    statusMap: Record<string, StreamStatus>;
    liveStreams: LiveStreamInfo[];
    loadingUserStreams: boolean;
    submitState: SubmitState;
    submitMessage: string;
    actionState: Record<string, ActionState>;
    actionMessage: Record<string, string>;
    selectedStream: IUserStream | null;
    setSelectedStream: (stream: IUserStream | null) => void;
    handleProviderSelect: (providerKey: string) => void;
    handleFormChange: (e: any) => void;
    handleFormSubmit: (fields: IFormField[]) => Promise<void>;
    handleToggle: (stream: IUserStream, nextEnabled: boolean) => Promise<void>;
    handleDelete: (stream: IUserStream) => Promise<void>;
    handleHlsResolved: (provider: string, hlsUrl: string, hlsResolvedAt: string | null) => void;
    devicesError: string | null;
}

export const useStreamPanel = ({
    current,
    memberService,
    eventId,
    userId,
}: UseStreamPanelArgs): UseStreamPanelResult => {
    const [provider, setProvider] = React.useState<string>('');
    const initProviderRef = React.useRef<string | null>(null);
    const [fieldResult, setFieldResult] = React.useState<StreamFieldsResult>({
        basicFields: [],
        advancedFields: [],
        allFields: [],
    });
    const isDirtyRef = React.useRef<boolean>(false);
    const prevProviderRef = React.useRef<string | null>(null);
    const { userStreams, loadingUserStreams, statusMap, refreshStreams } = useStreamStatus(memberService, eventId, userId);
    const { devices, loading: devicesLoading, error: devicesError, fetchDevices } = useAvailableStreamDevices();
    const [submitState, setSubmitState] = React.useState<SubmitState>('idle');
    const [submitMessage, setSubmitMessage] = React.useState<string>('');
    const [actionState, setActionState] = React.useState<Record<string, ActionState>>({});
    const [actionMessage, setActionMessage] = React.useState<Record<string, string>>({});
    const [selectedStream, setSelectedStream] = React.useState<IUserStream | null>(null);

    // Fetch devices on mount
    React.useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    // Keep selectedStream in sync with userStreams when polling refreshes the data
    React.useEffect(() => {
        if (!selectedStream) return;
        const key = getStreamCompositeKey(selectedStream);
        const updated = userStreams[key];
        // Only update selection if the reference actually changed; otherwise keep the current object to avoid flicker.
        if (updated && updated !== selectedStream) {
            setSelectedStream(updated);
        }
    }, [userStreams, selectedStream]);

    const buildFields = React.useCallback(
        (selectedProvider: string, streamEnabled: boolean = false, selected: IUserStream | null = null) =>
            buildStreamFields({
                selectedProvider,
                current,
                userStreams,
                devices,
                selectedStreamEnabled: streamEnabled && !devicesLoading,
                selectedStream: selected,
            }),
        [current, userStreams, devices, devicesLoading],
    );

    React.useEffect(() => {
        const initialProvider = (current?.provider as string) || 'twitch';
        if (initProviderRef.current === initialProvider) return;
        initProviderRef.current = initialProvider;
        isDirtyRef.current = false;
        setProvider(initialProvider);
        // No selected stream on initial mount
        setFieldResult(buildFields(initialProvider, false, null));
    }, [buildFields, current?.provider]);

    React.useEffect(() => {
        if (prevProviderRef.current === provider) return;
        prevProviderRef.current = provider;
        isDirtyRef.current = false;
        // No selected stream when changing provider
        setFieldResult(buildFields(provider, false, null));
    }, [buildFields, provider]);

    React.useEffect(() => {
        if (isDirtyRef.current) return; // keep user edits during polling
        // Use selectedStream.enabled state for device selector visibility
        const streamEnabled = selectedStream?.enabled ?? false;
        setFieldResult(buildFields(provider, streamEnabled, selectedStream));
    }, [buildFields, provider, userStreams, selectedStream]);

    const handleProviderSelect = React.useCallback(
        (providerKey: string) => {
            const nextProvider = (providerKey || 'custom').toLowerCase();
            isDirtyRef.current = false;
            setProvider(nextProvider);
            setSubmitState('idle');
            setSubmitMessage('');
            // No selected stream when switching providers
            setFieldResult(buildFields(nextProvider, false, null));
            setSelectedStream(null); // Clear selection when switching providers
        },
        [buildFields],
    );

    const handleFormChange = React.useCallback(
        (e: any) => {
            const { name, value } = e?.target || {};
            if (!name) return;

            const normalized = extractValue(value);

            isDirtyRef.current = true;
            setFieldResult((prev) => ({
                basicFields: prev.basicFields.map((field) =>
                    field.name === name ? { ...field, value: normalized } : field
                ),
                advancedFields: prev.advancedFields.map((field) =>
                    field.name === name ? { ...field, value: normalized } : field
                ),
                allFields: prev.allFields.map((field) =>
                    field.name === name ? { ...field, value: normalized } : field
                ),
            }));
        },
        [],
    );

    const handleFormSubmit = React.useCallback(
        async (fields: IFormField[]) => {
            if (!eventId) {
                setSubmitState('error');
                setSubmitMessage('Event not selected');
                return;
            }

            // Combine basic and advanced fields for payload
            const allFields = [...fieldResult.basicFields, ...fieldResult.advancedFields];
            const payload = buildPayloadFromFields(allFields, provider, eventId, userId || undefined);
            if (selectedStream?.id) {
                payload.id = selectedStream.id;
                payload.enabled = selectedStream.enabled;
            }

            setSubmitState('saving');
            setSubmitMessage('');

            try {
                await memberService.upsertUserStream(payload);
                await refreshStreams();
                isDirtyRef.current = false;
                // Rebuild with latest selected stream's enabled state
                const streamEnabled = selectedStream?.enabled ?? false;
                setFieldResult(buildFields(provider, streamEnabled, selectedStream));
                setSubmitState('success');
                setSubmitMessage('Stream settings saved');
            } catch (err: any) {
                setSubmitState('error');
                setSubmitMessage(err?.message || 'Failed to save stream');
            }
        },
        [buildFields, fieldResult, memberService, provider, refreshStreams, eventId, userId, selectedStream],
    );

    const withActionState = React.useCallback(
        (streamKey: string, state: ActionState, message?: string) => {
            setActionState((prev) => ({ ...prev, [streamKey]: state }));
            if (message !== undefined)
                setActionMessage((prev) => ({ ...prev, [streamKey]: message }));
        },
        [],
    );

    const handleToggle = React.useCallback(
        async (stream: IUserStream, nextEnabled: boolean) => {
            const streamKey = getStreamCompositeKey(stream);
            withActionState(streamKey, 'saving', '');
            try {
                const payload = buildPayloadFromStream(stream, {
                    enabled: nextEnabled,
                    eventId: stream.eventId || eventId || undefined,
                    userId: stream.userId || userId || undefined,
                });
                await memberService.upsertUserStream(payload);
                await refreshStreams();
                withActionState(streamKey, 'idle', nextEnabled ? 'Enabled' : 'Disabled');
            } catch (err: any) {
                withActionState(streamKey, 'error', err?.message || 'Toggle failed');
            }
        },
        [memberService, refreshStreams, eventId, userId, withActionState],
    );

    const handleDelete = React.useCallback(
        async (stream: IUserStream) => {
            const streamKey = getStreamCompositeKey(stream);
            withActionState(streamKey, 'deleting', '');
            try {
                // Use stream.id for deletion to support multi-stream
                const evtId = stream.eventId || eventId || '';
                await memberService.deleteUserStream(stream.id || stream.provider, evtId, userId || undefined);
                await refreshStreams();
                withActionState(streamKey, 'idle', 'Deleted');
                // Clear selection if deleted stream was selected
                if (selectedStream?.id === stream.id) {
                    setSelectedStream(null);
                }
            } catch (err: any) {
                withActionState(streamKey, 'error', err?.message || 'Delete failed');
            }
        },
        [memberService, refreshStreams, selectedStream?.id, eventId, userId, withActionState],
    );

    const handleHlsResolved = React.useCallback(
        (provider: string, hlsUrl: string, hlsResolvedAt: string | null) => {
            // Optimistically update selectedStream so the UI shows the new URL immediately
            setSelectedStream((prev) => {
                if (!prev || prev.provider !== provider) return prev;
                return { ...prev, hlsUrl, hlsResolvedAt };
            });
            // Also refresh the full stream list to keep userStreams in sync
            refreshStreams();
        },
        [refreshStreams],
    );

    const liveStreams = React.useMemo(() => getLiveStreams(userStreams), [userStreams]);

    return {
        basicFields: fieldResult.basicFields,
        advancedFields: fieldResult.advancedFields,
        formFields: fieldResult.allFields,
        userStreams,
        liveStreams,
        loadingUserStreams,
        statusMap,
        submitState,
        submitMessage,
        actionState,
        actionMessage,
        selectedStream,
        setSelectedStream,
        handleFormChange,
        handleProviderSelect,
        handleFormSubmit,
        handleToggle,
        handleDelete,
        handleHlsResolved,
        provider,
        devicesError,
    };
};
