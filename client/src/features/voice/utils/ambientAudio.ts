let ctx: AudioContext | null = null;
let nodes: { osc: OscillatorNode; gain: GainNode }[] = [];

export function startAmbientPad(): void {
  stopAmbientPad();
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.04;
  master.connect(ctx.destination);

  const freqs = [220, 329.63];
  nodes = freqs.map((freq) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.5;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    return { osc, gain };
  });
}

export function stopAmbientPad(): void {
  nodes.forEach(({ osc }) => {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
  });
  nodes = [];
  if (ctx) {
    ctx.close().catch(() => {});
    ctx = null;
  }
}
