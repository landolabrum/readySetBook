// Relative Path: ./RtmpPanel.tsx
import React from 'react';
import { getService } from '@webstack/common';
import styles from './StreamPanel.scss';
import UiForm from '@webstack/components/UiForm/controller/UiForm';
import { useUser } from '~/src/core/authentication/hooks/useUser';
import IMemberService from '~/src/core/services/MemberService/IMemberService';
import { useStreamPanel } from '../hooks/useStreamPanel';
import StreamList from '../views/StreamList/controller/StreamList';
import UiRadioLayout from '@webstack/layouts/UiRadioLayout/controller/UiRadioLayout';
import { UiIcon } from '@webstack/components/UiIcon/controller/UiIcon';
import useWindow from '@webstack/hooks/window/useWindow';
import AdaptTableCell from '@webstack/components/AdapTable/components/AdaptTableContent/components/AdaptTableCell/AdaptTableCell';

// Remember to create a sibling SCSS file with the same name as this component
interface IStreamPanel {
  current?: any;
}
const StreamPanel: React.FC<IStreamPanel> = ({ current }) => {
  const memberService = React.useMemo(() => getService<IMemberService>('IMemberService'), []);
  const user = useUser();
  const { width } = useWindow();
  const [show, setShow] = React.useState<boolean>(false);
  const userId = React.useMemo(() => {
    return (
      (user as any)?.id ||
      (user as any)?.user?.id ||
      (user as any)?.metadata?.user?.id ||
      null
    );
  }, [user]);
  const providerOptions = React.useMemo(() => ([
    { label: 'Twitch', value: 'twitch' },
    { label: 'YouTube', value: 'youtube' },
    { label: 'Facebook', value: 'facebook' },
    { label: 'Custom', value: 'custom' },
  ]), []);
  const eventId = React.useMemo(() => {
    return current?.id ? String(current.id) : null;
  }, [current?.id]);
  const {
    basicFields,
    advancedFields,
    userStreams,
    loadingUserStreams,
    statusMap,
    submitState,
    submitMessage,
    actionState,
    actionMessage,
    selectedStream,
    setSelectedStream,
    handleProviderSelect,
    handleFormChange,
    handleFormSubmit,
    handleToggle,
    handleDelete,
    handleHlsResolved,
    provider,
    devicesError,
  } = useStreamPanel({
    current,
    memberService,
    eventId,
    userId,
  });
  const providerVisuals = React.useMemo(
    () => ({
      twitch: { icon: 'fa-twitch', color: 'var(--purple-30)' },
      youtube: { icon: 'fa-youtube', color: 'var(--red-30)' },
      facebook: { icon: 'fa-facebook', color: 'var(--blue-30)' },
      custom: { icon: 'fa-burger-cheese', color: 'var(--red-70)' },
    }),
    [],
  );

  // Count configured streams per provider
  const configuredByProvider = React.useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(userStreams || {}).forEach((stream) => {
      const p = stream.provider || 'custom';
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [userStreams]);

  const totalConfiguredStreams = React.useMemo(
    () => Object.keys(userStreams || {}).length,
    [userStreams],
  );

  const providerViews = React.useMemo(
    () =>
      providerOptions.map(({ label, value }) => {
        const visuals = providerVisuals[value as keyof typeof providerVisuals];
        const streamCount = configuredByProvider[value] || 0;
        const isConfigured = streamCount > 0;

        return {
          id: value,
          navigation: {
            icon: visuals?.icon,
            badge: streamCount > 0 ? String(streamCount) : undefined,
            alt: `${label}${isConfigured ? ` (${streamCount})` : ''}`,
            color: provider === value && providerVisuals || isConfigured ? "var(--red-10)" : undefined,
            disabled: provider === value,
            glow: isConfigured
          },
          content: (<>
            <style jsx>{styles}</style>
            <div className="stream-panel__view">

              {devicesError && (
                <div className="stream-panel__status stream-panel__status--error" style={{ marginBottom: '8px' }}>
                  Server unreachable — device list unavailable. {devicesError}
                </div>
              )}

              <StreamList
                userStreams={userStreams}
                loadingUserStreams={loadingUserStreams}
                statusMap={statusMap}
                actionState={actionState}
                actionMessage={actionMessage}
                visibleProvider={value}
                selectedStream={selectedStream}
                onSelect={setSelectedStream}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onHlsResolved={handleHlsResolved}
              />

              <>
                <UiForm
                variant='flex'
                  title={<div className='d-flex s-w-100 justify-between align-center'>
                    <div>
                      {`Add ${label} Stream`}
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); setShow(!show); }}
                      style={{ cursor: 'pointer', padding: '4px' }}
                    >
                      <UiIcon alt={
                        show ? `Hide advanced settings` : `Show advanced settings`
                      } icon={show ? "fa-eye-slash" : "fa-gear"} />
                    </div>
                  </div>
                  }
                  fields={basicFields}
                  onChange={handleFormChange}
                  onSubmit={!show ? handleFormSubmit : undefined}
                  submitText={submitState === 'saving' ? `Saving ${label}` : `Add ${label} Stream`}
                  loading={submitState === 'saving'}
                  disabled={!userId}
                />
                {show && <UiForm
                  fields={advancedFields}
                  onChange={handleFormChange}
                  onSubmit={show ? handleFormSubmit : undefined}
                  submitText={submitState === 'saving' ? `Saving ${label}` : `Add ${label} Stream`}
                  disabled={!userId}
                />}

                {submitState !== 'idle' && (
                  <div className={`stream-panel__status stream-panel__status--${submitState}`}>
                    {submitState === 'saving' && (submitMessage || 'Saving...')}
                    {submitState === 'success' && (submitMessage || 'Saved')}
                    {submitState === 'error' && (submitMessage || 'Save failed')}
                  </div>
                )}
              </>

            </div>
          </>),
        };
      }),
    [
      actionMessage,
      actionState,
      advancedFields,
      basicFields,
      configuredByProvider,
      handleDelete,
      handleFormChange,
      handleFormSubmit,
      handleHlsResolved,
      handleToggle,
      loadingUserStreams,
      provider,
      providerOptions,
      providerVisuals,
      selectedStream,
      setSelectedStream,
      show,
      statusMap,
      submitMessage,
      submitState,
      userId,
      userStreams,
    ],
  );
  return (
    <>
      <style jsx>{styles}</style>
      <div className='stream-panel' onClick={
        (e) => { if (e.target === e.currentTarget) setSelectedStream(null); }
      }>
        <UiRadioLayout
          title={
          <AdaptTableCell cell="icon-label" data={
              {
                label: `Streams${totalConfiguredStreams > 0 ? ` (${totalConfiguredStreams})` : ''}`,
                icon:"fa-broadcast-tower"
              }
          }/>}
          views={providerViews}
          value={provider}
          onViewChange={handleProviderSelect}
          collapsed={width > 1100}
          layout={{ orientation: 'vertical', navigationPosition: 'left' }}
        />
      </div>
    </>
  );
};

export default StreamPanel;