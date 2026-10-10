export function getSpeakerOptions(params) {
  const receiver = params.has('receiver');
  return { receiver, postMessageEvents: receiver && params.get('postMessageEvents') === 'true' };
}
