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
    black: [3, 5, 7],
    gold: [211, 170, 93],
    light: [235, 218, 180],
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
  for (let index = 0; index < 1800; index += 1) {
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
    const field = point.y - 0.42 * Math.sin(Math.PI * point.x);
    points.push({
      ...point,
      // A continuous field, rather than a hard black/white split.
      yinWeight: (Math.tanh(field * 4.5) + 1) * 0.5,
      size: 0.72 + random() * 1.45,
      phase: random() * Math.PI * 2,
    });
  }

  // Antipodal poles become the two seed mouths after 4D rotation.
  const seeds = [
    { x: 0, y: 1, z: 0, w: 0, kind: 'yin' },
    { x: 0, y: -1, z: 0, w: 0, kind: 'yang' },
  ];
  const lightTargets = points.filter((point) => point.yinWeight < 0.42);
  const darkTargets = points.filter((point) => point.yinWeight > 0.58);

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

  function dot4(first, second) {
    return first.x * second.x + first.y * second.y + first.z * second.z + first.w * second.w;
  }

  function slerp4(start, end, amount) {
    const dot = clamp(dot4(start, end), -1, 1);
    if (Math.abs(dot) > 0.995) {
      return normalize4({
        x: start.x + (end.x - start.x) * amount,
        y: start.y + (end.y - start.y) * amount,
        z: start.z + (end.z - start.z) * amount,
        w: start.w + (end.w - start.w) * amount,
      });
    }
    const angle = Math.acos(dot);
    const sine = Math.sin(angle);
    const startWeight = Math.sin((1 - amount) * angle) / sine;
    const endWeight = Math.sin(amount * angle) / sine;
    return normalize4({
      x: start.x * startWeight + end.x * endWeight,
      y: start.y * startWeight + end.y * endWeight,
      z: start.z * startWeight + end.z * endWeight,
      w: start.w * startWeight + end.w * endWeight,
    });
  }

  function scatterOnSphere(point, amount, lane, time) {
    const candidate = {
      x: Math.sin(time * 0.41 + lane * 1.7),
      y: Math.cos(time * 0.37 + lane * 1.1),
      z: Math.sin(time * 0.29 + lane * 0.8),
      w: Math.cos(time * 0.23 + lane * 1.4),
    };
    const projection = dot4(point, candidate);
    const tangent = normalize4({
      x: candidate.x - point.x * projection,
      y: candidate.y - point.y * projection,
      z: candidate.z - point.z * projection,
      w: candidate.w - point.w * projection,
    });
    const spread = Math.sin(Math.PI * amount) * (0.035 + (lane % 5) * 0.009);
    return normalize4({
      x: point.x + tangent.x * spread,
      y: point.y + tangent.y * spread,
      z: point.z + tangent.z * spread,
      w: point.w + tangent.w * spread,
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

  function drawExchangePopulation(time, scale, centerX, centerY) {
    const lightCount = 42;
    const darkCount = 42;
    const lightMouth = seeds[1];
    const darkMouth = seeds[0];

    function drawParticle(point, color, alpha, radius, timeValue) {
      const projected = project(point, timeValue, scale, centerX, centerY);
      const size = radius * projected.perspective;
      const glow = context.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, size * 5);
      glow.addColorStop(0, rgba(color, alpha));
      glow.addColorStop(0.2, rgba(color, alpha * 0.3));
      glow.addColorStop(1, rgba(color, 0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(projected.x, projected.y, size * 5, 0, Math.PI * 2);
      context.fill();
    }

    context.save();
    context.globalCompositeOperation = 'lighter';

    // Light is released from the Yang mouth and scatters into the light field.
    for (let lane = 0; lane < lightCount; lane += 1) {
      const progress = (time * 0.045 + lane / lightCount) % 1;
      const targetIndex = (Math.floor(time * 0.035) + lane * 11) % lightTargets.length;
      const target = lightTargets[targetIndex];
      for (let trail = 0; trail < 4; trail += 1) {
        const trailProgress = (progress - trail * 0.018 + 1) % 1;
        const flow = scatterOnSphere(slerp4(lightMouth, target, trailProgress * trailProgress * (3 - trailProgress * 2)), trailProgress, lane, time);
        drawParticle(flow, palette.light, 0.36 - trail * 0.06, 1.3 - trail * 0.12, time);
      }
    }

    // Dark is gathered from the dark field, swallowed by Yin, then released again.
    for (let lane = 0; lane < darkCount; lane += 1) {
      const progress = (time * 0.041 + lane / darkCount + 0.18) % 1;
      const targetIndex = (Math.floor(time * 0.035) + lane * 7) % darkTargets.length;
      const nextTargetIndex = (targetIndex + 17) % darkTargets.length;
      const target = darkTargets[targetIndex];
      const nextTarget = darkTargets[nextTargetIndex];
      let flow;
      if (progress < 0.42) {
        const inhale = progress / 0.42;
        flow = slerp4(target, darkMouth, inhale * inhale * (3 - inhale * 2));
      } else {
        const release = (progress - 0.42) / 0.58;
        flow = slerp4(darkMouth, nextTarget, release * release * (3 - release * 2));
      }
        drawParticle(scatterOnSphere(flow, progress, lane + 80, time), palette.black, 0.82, 1.25, time);
    }
    context.restore();
  }

  function drawSeed(seed, time, scale, centerX, centerY) {
    const projected = project(seed, time, scale, centerX, centerY);
    const radius = scale * 0.052 * projected.perspective;
    const isDarkMouth = seed.kind === 'yin';
    const accent = isDarkMouth ? palette.gold : palette.light;

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
    if (isDarkMouth) {
      core.addColorStop(0, '#324b5b');
      core.addColorStop(0.28, rgba(palette.black, 0.99));
      core.addColorStop(0.72, rgba(palette.black, 0.99));
      core.addColorStop(1, rgba(accent, 0.18));
    } else {
      core.addColorStop(0, '#fffdf8');
      core.addColorStop(0.3, rgba(palette.paper, 0.98));
      core.addColorStop(0.72, rgba(palette.light, 0.98));
      core.addColorStop(1, rgba(palette.gold, 0.42));
    }
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

    const projectedPoints = points
      .map((point) => ({ point, projected: project(point, time, scale, centerX, centerY) }))
      .sort((a, b) => a.projected.depth - b.projected.depth);

    projectedPoints.forEach(({ point, projected }) => {
      const pulse = 0.86 + Math.sin(time * 0.8 + point.phase) * 0.14;
      const yinDensity = clamp((point.yinWeight - 0.43) / 0.14, 0, 1);
      const alpha = yinDensity > 0.86
        ? clamp(0.9 + projected.perspective * 0.08, 0.9, 1)
        : clamp((0.16 + projected.perspective * 0.24) * pulse + yinDensity * 0.5, 0.1, 0.95);
      const color = mixColor(palette.light, palette.black, yinDensity);
      context.fillStyle = rgba(color, alpha);
      context.beginPath();
      const radius = point.size * (1 + yinDensity * 0.22) * projected.perspective;
      context.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
      context.fill();
    });

    drawExchangePopulation(time, scale, centerX, centerY);
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
