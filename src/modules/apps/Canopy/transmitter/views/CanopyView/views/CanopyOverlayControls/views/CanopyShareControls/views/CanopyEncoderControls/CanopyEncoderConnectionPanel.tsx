import React from "react";
import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";
import UiForm from "@webstack/components/UiForm/controller/UiForm";
import { IFormField } from "@webstack/components/UiForm/models/IFormModel";
import styles from "./CanopyEncoderConnectionPanel.scss";

type Props = {
  streamKey: string;
  lanRtmpUrl: string;
  lanSrtUrl: string;
  lanHlsUrl: string;
  editingStreamKey: boolean;
  editStreamKeyValue: string;
  streamKeyError: string | null;
  setEditStreamKeyValue: (v: string) => void;
  handleSaveStreamKey: () => void;
  handleCancelEditStreamKey: () => void;
  handleEditStreamKey: () => void;
  copyToClipboard: (text: string) => void;
};

const CanopyEncoderConnectionPanel: React.FC<Props> = ({
  streamKey,
  lanRtmpUrl,
  lanSrtUrl,
  lanHlsUrl,
  editingStreamKey,
  editStreamKeyValue,
  streamKeyError,
  setEditStreamKeyValue,
  handleSaveStreamKey,
  handleCancelEditStreamKey,
  handleEditStreamKey,
  copyToClipboard,
}) => {
  const fields: IFormField[] = editingStreamKey
    ? [
        {
          name: "server", label: "RTMP Server", type: "text",
          value: lanRtmpUrl, disabled: true, variant: "link",
          traits: { afterIcon: { icon: "fa-copy", alt: "copy rtmp server", onClick: () => copyToClipboard(lanRtmpUrl) } },
        },
        {
          name: "stream_key", label: "Stream Key", type: "text",
          value: editStreamKeyValue, required: true,
          error: streamKeyError ?? undefined,
          onKeyDown: (e: any) => {
            if (e.key === "Enter") handleSaveStreamKey();
            if (e.key === "Escape") handleCancelEditStreamKey();
          },
        },
        { name: "cancel", label: "Cancel", type: "button", onClick: handleCancelEditStreamKey },
        {
          name: "srt_url", label: "SRT URL", type: "text",
          value: lanSrtUrl, disabled: true, variant: "link",
          traits: { afterIcon: { icon: "fa-copy", alt: "copy srt url", onClick: () => copyToClipboard(lanSrtUrl) } },
        },
        {
          name: "hls_url", label: "HLS Playback", type: "text",
          value: lanHlsUrl, disabled: true, variant: "link",
          traits: { afterIcon: { icon: "fa-copy", alt: "copy hls url", onClick: () => copyToClipboard(lanHlsUrl) } },
        },
      ]
    : [
        {
          name: "server", label: "RTMP Server", type: "text",
          value: lanRtmpUrl, disabled: true, variant: "link",
          traits: { afterIcon: { icon: "fa-copy", alt: "copy rtmp server", onClick: () => copyToClipboard(lanRtmpUrl) } },
        },
        {
          name: "stream_key", label: "Stream Key", type: "text",
          value: streamKey, disabled: true, variant: "link",
          traits: {
            beforeIcon: { icon: "fa-copy", alt: "copy stream key", onClick: () => copyToClipboard(streamKey) },
            afterIcon: { icon: "fa-pencil", alt: "edit stream key", onClick: handleEditStreamKey },
          },
        },
        {
          name: "srt_url", label: "SRT URL", type: "text",
          value: lanSrtUrl, disabled: true, variant: "link",
          traits: { afterIcon: { icon: "fa-copy", alt: "copy srt url", onClick: () => copyToClipboard(lanSrtUrl) } },
        },
        {
          name: "hls_url", label: "HLS Playback", type: "text",
          value: lanHlsUrl, disabled: true, variant: "link",
          traits: { afterIcon: { icon: "fa-copy", alt: "copy hls url", onClick: () => copyToClipboard(lanHlsUrl) } },
        },
      ];

  return (
    <>
      <style jsx>{styles}</style>
      <div className="encoder-panel">
        <div className="encoder-panel__header">
          <UiIcon icon="fa-broadcast-tower" />
          <span>Encoder Push Ready</span>
          <span className="encoder-panel__badge">SESSION ACTIVE</span>
        </div>

        <div className="encoder-panel__body">
          <div className="encoder-panel__body-title">
            <UiIcon icon="fa-broadcast-tower" /> Encoder Settings (YoloBox / OBS / Kiloview)
          </div>
          <UiForm
            fields={fields}
            onChange={editingStreamKey ? (e) => setEditStreamKeyValue(e.target.value) : undefined}
            onSubmit={editingStreamKey ? handleSaveStreamKey : undefined}
            submitText="Save"
          />
          <div className="encoder-panel__hls-note">
            This URL is automatically set on the overlay. Available once encoder starts streaming.
          </div>
        </div>

        <div className="encoder-panel__footer">
          <UiIcon icon="fa-info-circle" />
          Start streaming from your encoder. HLS playback appears when video is detected.
        </div>
      </div>
    </>
  );
};

export default CanopyEncoderConnectionPanel;
