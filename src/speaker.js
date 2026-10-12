export function getSpeakerOptions(params) {
  const receiver = params.has('receiver');
  return { receiver, postMessageEvents: receiver && params.get('postMessageEvents') === 'true' };
}

/** 外观单独同步，避免干扰 notes 插件的当前页/下一页状态协议。 */
export function syncSpeakerAppearance(host, getAppearance, applyAppearance, receiver) {
  const namespace = 'remark-speaker-appearance';
  const origin = host.location.origin;
  const frames = new Set();
  let controller;
  if (receiver) {
    try { controller = host.parent.opener; } catch { /* 控制窗口不可访问 */ }
  }
  const send = frame => {
    try {
      if (frame.closed) { frames.delete(frame); return; }
      frame.postMessage({ namespace, type: 'update', ...getAppearance() }, origin);
    } catch { frames.delete(frame); }
  };
  host.addEventListener('message', event => {
    if (event.origin !== origin || event.data?.namespace !== namespace) return;
    if (receiver) {
      if (controller && event.source === controller && event.data.type === 'update') applyAppearance(event.data);
    } else if (event.data.type === 'request') {
      try {
        if (event.source?.parent.opener !== host) return;
        frames.add(event.source);
        send(event.source);
      } catch { /* 非本窗口的演讲者预览 */ }
    }
  });
  if (controller) controller.postMessage({ namespace, type: 'request' }, origin);
  return { broadcast() { if (!receiver) for (const frame of frames) send(frame); } };
}
