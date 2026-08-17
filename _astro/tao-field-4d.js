(() => {
  const root = document.querySelector('[data-tao-4d]');
  if (!root) return;

  const frameElement = root.querySelector('.tao-4d-field__frame');
  const canvas = root.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!frameElement || !canvas || !context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0 };
  const palette = {
    ink: [23, 37, 50],
    gold: [211, 170, 93],
    paper: [244, 240, 231],
  };
  const points = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;

  const random = (() => {
    let seed = 2749;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  })();

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalize4(point) {
    const length = Math.hypot(point.x, point.y, point.z, point.w) || 1;
    return {
      x: point.x / length,
      y: point.y / length,
      z: point.z / length,
      w: point.w / length,
    };
  }

  function mixColor(from, to, amount) {
    return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
  }

  function rgba(color, alpha) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${clamp(alpha, 0, 1)})`;
  }

  // Uniform samples on S3, the unit 3-sphere embedded in four dimensions.
  for (let index = 0; index < 960; index += 1) {
    let sample = { x: 0, y: 0, z: 0, w: 0 };
    let length = 0;
    while (length < 0.2 || length > 1.7) {
      sample = {
        x: random() * 2 - 1,
        y: random() * 2 - 1,
        z: random() * 2 - 1,
        w: random() * 2 - 1,
      };
      length = Math.hypot(sample.x, sample.y, sample.z, sample.w);
    }
    const point = normalize4(sample);
    const field = point.y - 0.38 * Math.sin(Math.PI * point.x) * (0.82 + point.w * 0.18);
    points.push({
      ...point,
      // A continuous field, rather than a hard black/white split.
      yinWeight: (Math.tanh(field * 5) + 1) * 0.5,
      size: 0.5 + random() * 1.35,
      phase: random() * Math.PI * 2,
    });
  }

  // Antipodal poles become the two seed mouths after 4D rotation.
  const seeds = [
    { x: 0, y: 1, z: 0, w: 0, kind: 'yin' },
    { x: 0, y: -1, z: 0, w: 0, kind: 'yang' },
  ];

  function rotate(a, b, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [a * cosine - b * sine, a * sine + b * cosine];
  }

  function rotate4(point, time) {
    let { x, y, z, w } = point;
    [x, w] = rotate(x, w, time * 0.27 + pointer.x * 0.22);
    [y, z] = rotate(y, z, time * 0.19 - pointer.y * 0.16);
    [z, w] = rotate(z, w, time * 0.13);
    [x, y] = rotate(x, y, time * 0.09);
    return { x, y, z, w };
  }

  // Stereographic projection reveals the fourth coordinate as depth and scale.
  function project(point, time, scale, centerX, centerY) {
    const rotated = rotate4(point, time);
    const stereo = 1 / (1.7 - rotated.w * 0.48);
    let x = rotated.x * stereo;
    let y = rotated.y * stereo;
    let z = rotated.z * stereo;

    [x, z] = rotate(x, z, time * 0.16 + pointer.x * 0.3);
    [y, z] = rotate(y, z, -0.22 + pointer.y * 0.22);

    const perspective = 1 / (1.62 - z * 0.24);
    return {
      x: centerX + x * scale * perspective,
      y: centerY + y * scale * perspective,
      depth: z + rotated.w * 0.32,
      perspective,
    };
  }

  function resize() {
    const bounds = frameElement.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawHypersphereGuides(time, scale, centerX, centerY) {
    const planes = [
      (angle) => ({ x: Math.cos(angle), y: Math.sin(angle), z: 0, w: 0 }),
      (angle) => ({ x: Math.cos(angle), y: 0, z: Math.sin(angle), w: 0 }),
      (angle) => ({ x: Math.cos(angle), y: 0, z: 0, w: Math.sin(angle) }),
      (angle) => ({ x: 0, y: Math.cos(angle), z: Math.sin(angle), w: 0 }),
    ];

    planes.forEach((plane, planeIndex) => {
      context.beginPath();
      for (let step = 0; step <= 72; step += 1) {
        const angle = (step / 72) * Math.PI * 2;
        const projected = project(plane(angle), time + planeIndex * 0.08, scale, centerX, centerY);
        if (step === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      }
      context.strokeStyle = planeIndex === 2 ? rgba(palette.gold, 0.13) : rgba(palette.ink, 0.065);
      context.lineWidth = planeIndex === 2 ? 0.85 : 0.55;
      context.stroke();
    });
  }

  function energyPoint(progress, lane, direction, time) {
    const pathProgress = direction === 0 ? progress : 1 - progress;
    const angle = lane * 0.88 + time * 0.32 + pathProgress * Math.PI * 2.2;
    const middle = Math.pow(Math.sin(Math.PI * pathProgress), 0.72);
    const spread = 0.025 + middle * (0.18 + (lane % 5) * 0.018);
    const baseAngle = Math.PI * pathProgress;
    const base = { x: Math.sin(baseAngle), y: Math.cos(baseAngle), z: 0, w: 0 };
    const ring = {
      x: 0,
      y: 0,
      z: Math.cos(angle),
      w: Math.sin(angle),
    };
    const cosine = Math.cos(spread);
    const sine = Math.sin(spread);
    return normalize4({
      x: base.x * cosine + ring.x * sine,
      y: base.y * cosine + ring.y * sine,
      z: base.z * cosine + ring.z * sine,
      w: base.w * cosine + ring.w * sine,
    });
  }

  function drawAttractorHalo(seed, time, scale, centerX, centerY) {
    const projected = project(seed, time, scale, centerX, centerY);
    const radius = scale * 0.22 * projected.perspective;
    const accent = seed.kind === 'yin' ? palette.gold : palette.paper;
    const halo = context.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius);
    halo.addColorStop(0, rgba(accent, 0.2));
    halo.addColorStop(0.22, rgba(accent, 0.08));
    halo.addColorStop(1, rgba(accent, 0));
    context.fillStyle = halo;
    context.beginPath();
    context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawEnergyStreams(time, scale, centerX, centerY) {
    const streamCount = 24;
    context.save();
    context.globalCompositeOperation = 'lighter';

    for (let direction = 0; direction < 2; direction += 1) {
      const color = direction === 0 ? palette.gold : palette.ink;
      for (let lane = 0; lane < streamCount; lane += 1) {
        context.beginPath();
        for (let step = 0; step <= 52; step += 1) {
          const progress = step / 52;
          const projected = project(energyPoint(progress, lane, direction, time), time, scale, centerX, centerY);
          if (step === 0) context.moveTo(projected.x, projected.y);
          else context.lineTo(projected.x, projected.y);
        }
        context.strokeStyle = rgba(color, 0.055 + (lane % 4) * 0.009);
        context.lineWidth = 0.45 + (lane % 3) * 0.2;
        context.stroke();

        for (let particle = 0; particle < 2; particle += 1) {
          const progress = (time * 0.085 + lane / streamCount + particle * 0.47 + direction * 0.12) % 1;
          const projected = project(energyPoint(progress, lane, direction, time), time, scale, centerX, centerY);
          const radius = (1.2 + (lane % 3) * 0.38) * projected.perspective;
          const glow = context.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius * 5);
          glow.addColorStop(0, rgba(color, 0.8));
          glow.addColorStop(0.18, rgba(color, 0.28));
          glow.addColorStop(1, rgba(color, 0));
          context.fillStyle = glow;
          context.beginPath();
          context.arc(projected.x, projected.y, radius * 5, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    context.restore();
  }

  function drawSeed(seed, time, scale, centerX, centerY) {
    const projected = project(seed, time, scale, centerX, centerY);
    const radius = scale * 0.052 * projected.perspective;
    const accent = seed.kind === 'yin' ? palette.gold : palette.paper;

    context.save();
    context.globalCompositeOperation = 'lighter';
    for (let ring = 4; ring > 0; ring -= 1) {
      context.beginPath();
      context.ellipse(projected.x, projected.y, radius * (1.3 + ring * 0.72), radius * (0.5 + ring * 0.25), time * 0.55, 0, Math.PI * 2);
      context.strokeStyle = rgba(accent, ring === 1 ? 0.48 : 0.09);
      context.lineWidth = ring === 1 ? 1 : 0.55;
      context.stroke();
    }
    context.globalCompositeOperation = 'source-over';
    const core = context.createRadialGradient(projected.x - radius * 0.28, projected.y - radius * 0.34, 0, projected.x, projected.y, radius);
    core.addColorStop(0, '#324b5b');
    core.addColorStop(0.28, rgba(palette.ink, 0.98));
    core.addColorStop(0.72, rgba(palette.ink, 0.98));
    core.addColorStop(1, rgba(accent, 0.18));
    context.fillStyle = core;
    context.beginPath();
    context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const scale = Math.min(width, height) * 0.41;

    seeds.forEach((seed) => drawAttractorHalo(seed, time, scale, centerX, centerY));
    drawHypersphereGuides(time, scale, centerX, centerY);
    drawEnergyStreams(time, scale, centerX, centerY);

    const projectedPoints = points
      .map((point) => ({ point, projected: project(point, time, scale, centerX, centerY) }))
      .sort((a, b) => a.projected.depth - b.projected.depth);

    projectedPoints.forEach(({ point, projected }) => {
      const pulse = 0.86 + Math.sin(time * 0.8 + point.phase) * 0.14;
      const alpha = clamp((0.14 + projected.perspective * 0.28) * pulse, 0.08, 0.58);
      const color = mixColor(palette.gold, palette.ink, point.yinWeight);
      context.fillStyle = rgba(color, alpha);
      context.beginPath();
      context.arc(projected.x, projected.y, point.size * projected.perspective, 0, Math.PI * 2);
      context.fill();
    });

    seeds.forEach((seed) => drawSeed(seed, time, scale, centerX, centerY));
  }

  root.addEventListener('pointermove', (event) => {
    const bounds = frameElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  });
  root.addEventListener('pointerleave', () => {
    pointer.x = 0;
    pointer.y = 0;
  });

  const observer = new ResizeObserver(resize);
  observer.observe(frameElement);
  resize();

  function animate(timestamp) {
    draw(reducedMotion.matches ? 0.35 : timestamp * 0.001);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
  }

  animate(0);
  reducedMotion.addEventListener?.('change', () => {
    window.cancelAnimationFrame(frame);
    animate(performance.now());
  });
})();
