import { useEffect, useMemo, useState } from "react";
import * as logoCatalog from "../themes/logoCatalog";

function getPresetLogo(presetId) {
  if (typeof logoCatalog.getLogoPresetAsset === "function") {
    return logoCatalog.getLogoPresetAsset(presetId);
  }
  return logoCatalog.DEFAULT_THEME_LOGO ?? "";
}

function getLogoPresetOptions() {
  if (Array.isArray(logoCatalog.LOGO_PRESET_OPTIONS)) {
    return logoCatalog.LOGO_PRESET_OPTIONS;
  }
  return [
    {
      id: "default-light",
      label: "Default Light",
      src: getPresetLogo("default-light"),
    },
  ];
}

function normalizeLogoPresetId(presetId) {
  return String(presetId || "").replace(/^comic-/, "default-");
}

function loadImageForCanvas(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });
}

async function loadEditableImage(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error("Image fetch failed");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = await loadImageForCanvas(objectUrl);
    image.__avatarObjectUrl = objectUrl;
    return image;
  } catch {
    return loadImageForCanvas(src);
  }
}

function canvasToPngFile(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Avatar render failed"));
        return;
      }
      resolve(new File([blob], fileName, { type: "image/png" }));
    }, "image/png");
  });
}

async function renderAvatarEditToFile({ src, zoom, rotation, panX, panY }) {
  const image = await loadEditableImage(src);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  const naturalWidth = image.naturalWidth || image.width || size;
  const naturalHeight = image.naturalHeight || image.height || size;
  const coverScale = Math.max(size / naturalWidth, size / naturalHeight);
  const safeZoom = Math.max(1, Number(zoom) || 1);
  const safeRotation = ((Number(rotation) || 0) * Math.PI) / 180;
  const frameSize = 316;
  const panScale = size / frameSize;

  context.clearRect(0, 0, size, size);
  context.save();
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.translate(size / 2 + panX * panScale, size / 2 + panY * panScale);
  context.rotate(safeRotation);
  context.scale(coverScale * safeZoom, coverScale * safeZoom);
  context.drawImage(image, -naturalWidth / 2, -naturalHeight / 2);
  context.restore();
  if (image.__avatarObjectUrl) {
    URL.revokeObjectURL(image.__avatarObjectUrl);
  }

  return canvasToPngFile(canvas, `avatar-${Date.now()}.png`);
}

export default function AvatarPickerOverlay({
  userIconUrl,
  userIconStorageId,
  recentUserIcons = [],
  userIconPreset,
  userIconState,
  onUploadUserIcon,
  onSelectUserIconStorageId,
  onSelectUserIconPreset,
  onClose,
}) {
  const [localMessage, setLocalMessage] = useState("");
  const [editingAvatar, setEditingAvatar] = useState(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarRotation, setAvatarRotation] = useState(0);
  const [avatarPan, setAvatarPan] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);
  const [isRenderingEdit, setIsRenderingEdit] = useState(false);
  const logoPresetOptions = useMemo(() => getLogoPresetOptions(), []);
  const recentAvatars = useMemo(() => {
    const imageItems = [];
    const seenStorageIds = new Set();
    const currentStorageId = String(userIconStorageId || "");

    if (userIconUrl) {
      imageItems.push({
        id: currentStorageId || "current-upload",
        label: "Current",
        src: userIconUrl,
        storageId: currentStorageId,
        type: "image",
      });
      if (currentStorageId) {
        seenStorageIds.add(currentStorageId);
      }
    }

    for (const item of recentUserIcons || []) {
      const storageId = String(item?.storageId || "");
      const url = String(item?.url || "");
      if (!storageId || !url || seenStorageIds.has(storageId)) {
        continue;
      }
      imageItems.push({
        id: storageId,
        label: "Recent",
        src: url,
        storageId,
        type: "image",
      });
      seenStorageIds.add(storageId);
    }

    const presetItems = logoPresetOptions.map((option) => ({
      id: option.id,
      label: option.label,
      src: option.src,
      preset: option.id,
      type: "preset",
    }));

    return [...imageItems.slice(0, 3), ...presetItems];
  }, [logoPresetOptions, recentUserIcons, userIconStorageId, userIconUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onEscapeKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscapeKey);
    };
  }, [onClose]);

  useEffect(() => {
    const onPasteImage = (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) =>
        String(item.type || "").startsWith("image/"),
      );
      const file = imageItem?.getAsFile?.();
      if (!file) {
        return;
      }

      event.preventDefault();
      setLocalMessage("Uploading");
      onUploadUserIcon?.(file);
    };

    window.addEventListener("paste", onPasteImage);
    return () => {
      window.removeEventListener("paste", onPasteImage);
    };
  }, [onUploadUserIcon]);

  const onChooseGif = () => {
    setLocalMessage("Premium required.");
  };

  const onEditAvatar = (avatar) => {
    setLocalMessage("");
    setAvatarZoom(1);
    setAvatarRotation(0);
    setAvatarPan({ x: 0, y: 0 });
    setEditingAvatar(avatar);
  };

  const onApplyAvatar = async () => {
    if (!editingAvatar?.src || isRenderingEdit) {
      return;
    }

    setIsRenderingEdit(true);
    setLocalMessage("");
    try {
      const file = await renderAvatarEditToFile({
        src: editingAvatar.src,
        zoom: avatarZoom,
        rotation: avatarRotation,
        panX: avatarPan.x,
        panY: avatarPan.y,
      });
      await onUploadUserIcon?.(file);
      setEditingAvatar(null);
    } catch {
      if (editingAvatar?.preset) {
        onSelectUserIconPreset?.(editingAvatar.preset);
      } else if (editingAvatar?.storageId) {
        onSelectUserIconStorageId?.(editingAvatar.storageId);
      }
      setEditingAvatar(null);
    } finally {
      setIsRenderingEdit(false);
    }
  };

  const onStartDragAvatar = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: avatarPan.x,
      panY: avatarPan.y,
    });
  };

  const onDragAvatar = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setAvatarPan({
      x: dragState.panX + event.clientX - dragState.startX,
      y: dragState.panY + event.clientY - dragState.startY,
    });
  };

  const onStopDragAvatar = (event) => {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null);
    }
  };

  return (
    <section
      className="avatar-picker-overlay"
      aria-label="Avatar picker"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section className="avatar-picker-panel">
        <header className="avatar-picker-header">
          <h2>{editingAvatar ? "Edit Image" : "Select Avatar"}</h2>
          <button
            type="button"
            className="avatar-picker-close"
            onClick={() => {
              if (editingAvatar) {
                setEditingAvatar(null);
                return;
              }
              onClose?.();
            }}
            aria-label="Close"
            title="Close"
          >
            x
          </button>
        </header>

        {editingAvatar ? (
          <section className="avatar-editor">
            <div className="avatar-editor-stage">
              <div
                className="avatar-editor-frame"
                aria-label="Position avatar"
                role="img"
                onPointerDown={onStartDragAvatar}
                onPointerMove={onDragAvatar}
                onPointerUp={onStopDragAvatar}
                onPointerCancel={onStopDragAvatar}
              >
                <img
                  src={editingAvatar.src}
                  alt=""
                  style={{
                    transform: `translate(${avatarPan.x}px, ${avatarPan.y}px) scale(${avatarZoom}) rotate(${avatarRotation}deg)`,
                  }}
                  draggable={false}
                />
              </div>
            </div>

            <div className="avatar-editor-controls">
              <span className="avatar-editor-range-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M5 5h10v10H5V5Zm2 2v6h6V7H7Zm9 3 3 3v6H9l-3-3h10v-6Z" />
                </svg>
              </span>
              <input
                type="range"
                min="1"
                max="2.4"
                step="0.05"
                value={avatarZoom}
                onChange={(event) => setAvatarZoom(Number(event.target.value))}
                aria-label="Zoom"
              />
              <span className="avatar-editor-range-icon large" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M4 5h9v7H4V5Zm2 2v3h5V7H6Zm8.5 2.5 3.5 3.5v6H8l-3.5-3.5H16V9.5h-1.5Z" />
                </svg>
              </span>
              <button
                type="button"
                className="avatar-editor-rotate"
                onClick={() => setAvatarRotation((value) => value + 90)}
                aria-label="Rotate"
                title="Rotate"
              >
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z" />
                </svg>
              </button>
            </div>

            <div className="avatar-editor-premium">
              <span>[PLACEHOLDER 2]</span>
              <button type="button" className="action" onClick={onChooseGif}>
                Premium
              </button>
            </div>

            <footer className="avatar-editor-actions">
              <button
                type="button"
                className="avatar-editor-reset"
                onClick={() => {
                  setAvatarZoom(1);
                  setAvatarRotation(0);
                  setAvatarPan({ x: 0, y: 0 });
                }}
              >
                Reset
              </button>
              <div>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setEditingAvatar(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="action"
                  onClick={() => void onApplyAvatar()}
                  disabled={isRenderingEdit}
                >
                  {isRenderingEdit ? "Applying" : "Apply"}
                </button>
              </div>
            </footer>
          </section>
        ) : (
          <>
            <div className="avatar-picker-grid">
              <label className="avatar-upload-tile">
                <span className="avatar-upload-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img" focusable="false">
                    <path d="M5.5 4h9.2a2 2 0 0 1 2 2v4.2h-2V6H5.5v10h5.2v2H5.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1.3 9.1 2.3-2.8a1 1 0 0 1 1.5 0l1.4 1.6 1-1.2a1 1 0 0 1 1.5 0l1 1.2v1.9H6.8v-.7Zm11.7-1.4a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1Z" />
                  </svg>
                </span>
                <span>{userIconState?.busy ? "Uploading" : "Upload"}</span>
                <input
                  type="file"
                  accept="image/*"
                onChange={onUploadUserIcon}
                disabled={userIconState?.busy}
              />
              </label>

              <button
                type="button"
                className="avatar-gif-tile"
                onClick={onChooseGif}
              >
                <span className="avatar-gif-badge">GIF</span>
                <span>GIF</span>
              </button>
            </div>

            <section className="avatar-recent-section">
              <h3>Recent Avatars</h3>
              <div className="avatar-recent-row">
                {recentAvatars.map((avatar) => {
                  const isActive =
                    avatar.type === "preset"
                      ? !userIconUrl &&
                        avatar.preset === normalizeLogoPresetId(userIconPreset)
                      : Boolean(
                          userIconUrl &&
                            ((avatar.storageId &&
                              avatar.storageId === userIconStorageId) ||
                              avatar.src === userIconUrl),
                        );

                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      className={`avatar-recent-button${isActive ? " active" : ""}`}
                      onClick={() => onEditAvatar(avatar)}
                      aria-label={avatar.label}
                      title={avatar.label}
                    >
                      <img src={avatar.src} alt="" />
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {(localMessage || userIconState?.message) && (
          <p className="avatar-picker-status">
            {localMessage || userIconState.message}
          </p>
        )}
      </section>
    </section>
  );
}
