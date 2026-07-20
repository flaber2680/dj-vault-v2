"use client";

import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

import {
  HERO_STRANDS,
  isHeroStrandsEnabled,
} from "@/components/effects/hero-strands-config";

const MAX_COLORS = 2;

const vertexShader = `#version 300 es
in vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColors[${MAX_COLORS}];
uniform float uSpeed;
uniform float uOpacity;

out vec4 fragColor;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float taper = pow(max(cos(uv.x * 3.14159265 * 1.28), 0.0), 1.8);
  float time = uTime * uSpeed;
  vec3 color = vec3(0.0);

  for (int index = 0; index < ${HERO_STRANDS.strandCount}; index++) {
    float strand = float(index);
    float wave = sin(uv.x * (2.0 + strand * 0.35) + time * (1.2 + strand * 0.3) + strand * 1.7) * 0.045;
    wave += sin(uv.x * 3.4 - time * 0.55 + strand) * 0.018;

    float distanceToStrand = abs(uv.y - wave);
    float width = 0.008 + taper * 0.006;
    float glow = width / (distanceToStrand + width * 0.65);
    glow *= glow;
    color += uColors[index] * glow * taper;
  }

  color = 1.0 - exp(-color * 0.58);
  float alpha = clamp(max(max(color.r, color.g), color.b), 0.0, 1.0) * uOpacity;
  fragColor = vec4(color * uOpacity, alpha);
}`;

function buildPalette() {
  return HERO_STRANDS.colors.map((color) => {
    const value = new Color(color);
    return [value.r, value.g, value.b];
  });
}

export function HeroStrands() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const probe = document.createElement("canvas");
    const supportsWebgl2 = Boolean(probe.getContext("webgl2"));

    if (
      !isHeroStrandsEnabled({
        viewportWidth: window.innerWidth,
        prefersReducedMotion: motionQuery.matches,
        supportsWebgl2,
      })
    ) {
      return;
    }

    let animationFrame = 0;
    let isVisible = true;
    let isDisposed = false;
    let failedRenderer: Renderer | null = null;
    let failedCanvas: HTMLCanvasElement | null = null;

    try {
      const renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: HERO_STRANDS.dpr,
        premultipliedAlpha: true,
        webgl: 2,
      });
      failedRenderer = renderer;
      const gl = renderer.gl;
      const canvas = gl.canvas as HTMLCanvasElement;
      failedCanvas = canvas;
      const geometry = new Triangle(gl);

      if (geometry.attributes.uv) {
        delete geometry.attributes.uv;
      }

      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [container.clientWidth, container.clientHeight] },
          uColors: { value: buildPalette() },
          uSpeed: { value: HERO_STRANDS.speed },
          uOpacity: { value: 0.52 },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      container.appendChild(canvas);

      const resize = () => {
        const { clientWidth: width, clientHeight: height } = container;

        if (!width || !height) {
          return;
        }

        renderer.setSize(width, height);
        program.uniforms.uResolution.value = [width, height];
      };

      const shouldRender = () =>
        isVisible &&
        isHeroStrandsEnabled({
          viewportWidth: window.innerWidth,
          prefersReducedMotion: motionQuery.matches,
          supportsWebgl2,
        });

      const stop = () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      };

      const render = (time: number) => {
        if (isDisposed || !shouldRender()) {
          animationFrame = 0;
          return;
        }

        program.uniforms.uTime.value = time * 0.001;
        renderer.render({ scene: mesh });
        animationFrame = requestAnimationFrame(render);
      };

      const start = () => {
        if (!animationFrame && shouldRender()) {
          animationFrame = requestAnimationFrame(render);
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        resize();

        if (shouldRender()) {
          start();
        } else {
          stop();
        }
      });
      resizeObserver.observe(container);

      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;

          if (isVisible) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0 },
      );
      intersectionObserver.observe(container);

      window.addEventListener("resize", resize, { passive: true });
      resize();
      start();

      return () => {
        isDisposed = true;
        stop();
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        window.removeEventListener("resize", resize);

        if (canvas.parentNode === container) {
          container.removeChild(canvas);
        }

        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    } catch {
      if (failedCanvas?.parentNode === container) {
        container.removeChild(failedCanvas);
      }

      failedRenderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      return;
    }
  }, []);

  return <div ref={containerRef} className="hero-strands" aria-hidden="true" />;
}
