(() => {
  const root = document.querySelector('[data-tao-4d]');
  if (!root) return;

  const canvas = root.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0 };
  const palette = {
    ink: '#172532',
    gold: '#d3aa5d',
    paper: '#f4f0e7',
    muted: '#66717b',
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

  for (let index = 0; index < 560; index += 1) {
    const theta = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 1.03;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const z = (random() - 0.5) * 0.18 + Math.sin(theta * 2) * radius * 0.07;
    const w = Math.sin(theta * 2 + radius * 1.8) * 0.42 * radius + (random() - 0.5) * 0.08;
    const field = y - 0.34 * Math.sin(Math.PI * x);
    points.push({
      x, y, z, w,
      kind: field > 0 ? 'yin' : 'yang',
      size: 0.55 + random() * 1.25,
      phase: random() * Math.PI * 2,
    });
  }

  const seeds = [
    { x: -0.1, y: 0.55, z: 0.04, w: 0.12, kind: 'yin' },
    { x: 0.1, y: -0.55, z: -0.04, w: -0.12, kind: 'yang' },
  ];

  function rotate(a, b, angle) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [a * cosine - b * sine, a * sine + b * cosine];
  }

  function project(point, time, scale, centerX, centerY) {
    let { x, y, z, w } = point;
    [x, w] = rotate(x, w, time * 0.27 + pointer.x * 0.22);
    [y, z] = rotate(y, z, time * 0.19 - pointer.y * 0.16);
    [z, w] = rotate(z, w, time * 0.13);
    [x, y] = rotate(x, y, time * 0.09);

    const yaw = time * 0.16 + pointer.x * 0.3;
    [x, z] = rotate(x, z, yaw);
    const pitch = -0.22 + pointer.y * 0.22;
    [y, z] = rotate(y, z, pitch);

    const perspective = 1 / (1.5 - z * 0.26 - w * 0.13);
    return {
      x: centerX + x * scale * perspective,
      y: centerY + y * scale * perspective,
      depth: z + w * 0.25,
      perspective,
    };
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawOrbitalShell(time, scale, centerX, centerY) {
    for (let shell = 0; shell < 4; shell += 1) {
      const tilt = (shell - 1.5) * 0.28;
      context.beginPath();
      for (let step = 0; step <= 72; step += 1) {
        const theta = (step / 72) * Math.PI * 2;
        const point = {
          x: Math.cos(theta) * 1.08,
          y: Math.sin(theta) * 1.08,
          z: tilt * 0.22,
          w: Math.sin(theta * 2 + time * 0.6 + shell) * 0.22,
        };
        const projected = project(point, time, scale, centerX, centerY);
        if (step === 0) context.moveTo(projected.x, projected.y);
        else context.lineTo(projected.x, projected.y);
      }
      context.strokeStyle = shell === 2 ? `${palette.gold}55` : `${palette.ink}22`;
      context.lineWidth = shell === 2 ? 1.2 : 0.7;
      context.stroke();
    }
  }

  function drawEnergyPaths(time, scale, centerX, centerY) {
    seeds.forEach((seed, seedIndex) => {
      const origin = project(seed, time, scale, centerX, centerY);
      for (let line = 0; line < 13; line += 1) {
        const direction = seedIndex === 0 ? 1 : -1;
        const angle = (line / 13) * Math.PI * 1.55 - Math.PI * 0.78;
        const target = {
          x: direction * (0.86 + Math.cos(angle) * 0.18),
          y: seed.y + Math.sin(angle) * 0.8,
          z: Math.sin(angle) * 0.28,
          w: Math.cos(angle + time * 0.4) * 0.35,
        };
        const control = {
          x: (seed.x + target.x) * 0.42 + Math.sin(time + line) * 0.08,
          y: (seed.y + target.y) * 0.45,
          z: 0.3,
          w: (seed.w + target.w) * 0.5,
        };
        const controlPoint = project(control, time, scale, centerX, centerY);
        const targetPoint = project(target, time, scale, centerX, centerY);
        context.beginPath();
        context.moveTo(origin.x, origin.y);
        context.quadraticCurveTo(controlPoint.x, controlPoint.y, targetPoint.x, targetPoint.y);
        context.strokeStyle = seedIndex === 0 ? `${palette.gold}36` : `${palette.ink}28`;
        context.lineWidth = 0.65;
        context.setLineDash([2, 7]);
        context.lineDashOffset = -time * 18 - line * 4;
        context.stroke();
      }
    });
    context.setLineDash([]);
  }

  function drawSeed(seed, time, scale, centerX, centerY) {
    const projected = project(seed, time, scale, centerX, centerY);
    const radius = scale * 0.095 * projected.perspective;
    const isDark = seed.kind === 'yin';
    const color = isDark ? palette.ink : palette.paper;
    const accent = isDark ? palette.gold : palette.ink;

    context.save();
    context.globalCompositeOperation = 'lighter';
    for (let ring = 3; ring > 0; ring -= 1) {
      context.beginPath();
      context.arc(projected.x, projected.y, radius * (1.4 + ring * 0.4), 0, Math.PI * 2);
      context.strokeStyle = `${accent}${ring === 1 ? '90' : '32'}`;
      context.lineWidth = ring === 1 ? 1.2 : 0.6;
      context.stroke();
    }
    const gradient = context.createRadialGradient(projected.x - radius * 0.25, projected.y - radius * 0.3, 0, projected.x, projected.y, radius);
    gradient.addColorStop(0, isDark ? '#314958' : '#fffdf8');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, isDark ? '#050b10' : '#b99551');
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const scale = Math.min(width, height) * 0.34;

    drawOrbitalShell(time, scale, centerX, centerY);
    drawEnergyPaths(time, scale, centerX, centerY);

    const projectedPoints = points
      .map((point) => ({ point, projected: project(point, time, scale, centerX, centerY) }))
      .sort((a, b) => a.projected.depth - b.projected.depth);

    projectedPoints.forEach(({ point, projected }) => {
      const alpha = Math.max(0.16, Math.min(0.8, 0.3 + projected.perspective * 0.24));
      const color = point.kind === 'yin' ? palette.ink : palette.gold;
      context.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      context.beginPath();
      context.arc(projected.x, projected.y, point.size * projected.perspective, 0, Math.PI * 2);
      context.fill();
    });

    seeds.forEach((seed) => drawSeed(seed, time, scale, centerX, centerY));

    context.strokeStyle = `${palette.ink}45`;
    context.lineWidth = 0.7;
    context.beginPath();
    context.moveTo(centerX - scale * 1.2, centerY);
    context.lineTo(centerX + scale * 1.2, centerY);
    context.stroke();
  }

  root.addEventListener('pointermove', (event) => {
    const bounds = root.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  });
  root.addEventListener('pointerleave', () => {
    pointer.x = 0;
    pointer.y = 0;
  });

  const observer = new ResizeObserver(resize);
  observer.observe(root);
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
