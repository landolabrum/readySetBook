import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree,  } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import IconHelper from "@webstack/helpers/IconHelper";
import styles from "./TJSCube.scss";
import { useThreeInteraction } from '../hooks/useThreeInteractions';

interface ITJSCubeBevel {
  curveSegments?: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelOffset?: number;
  bevelSegments?: number;
}

interface ITJSCubeIcon {
  icon: string;
  color?: string;
  backgroundColor?: string;
  size: { x: number, y: number, z: number } | [number, number, number];
  animate?: { rotate: { y?: number, x?: number, z?: number, speed: number } };
  metalness?: number;
  roughness?: number;
  texture?: string;
  bevel?: ITJSCubeBevel;
  opacity?: number;
}

interface ITJSCubeContent {
  icon?: ITJSCubeIcon | string;
  color?: string;
  backgroundColor?: string;
  size?: { x: number, y: number, z: number } | [number, number, number];
  animate?: { rotate: { y?: number, x?: number, z?: number, speed: number } };
  metalness?: number;
  roughness?: number;
  texture?: string;
  bevel?: ITJSCubeBevel;
  opacity?: number;
}

const TJSCubeContent = (props: ITJSCubeContent) => {
  const meshRef = useRef<THREE.Mesh|any>(null);
  const particlesRef = useRef<THREE.Points|any>(null);
  const { scene, camera } = useThree();

  const icon = useMemo(() => {
    const config: ITJSCubeIcon = typeof props.icon === 'object' && props.icon !== null && 'icon' in props.icon
      ? props.icon
      : {
          icon: typeof props.icon === 'string' ? props.icon : '',
          color: props.color,
          backgroundColor: props.backgroundColor,
          size: props.size || { x: 100, y: 100, z: 1 },
          animate: props.animate,
          metalness: props.metalness,
          roughness: props.roughness,
          texture: props.texture,
          bevel: props.bevel,
          opacity: props.opacity,
        };
    const normalizedSize = Array.isArray(config.size)
      ? { x: config.size[0], y: config.size[1], z: config.size[2] }
      : config.size as { x: number, y: number, z: number };
    return { ...config, size: normalizedSize };
  }, [props.icon, props.color, props.backgroundColor, props.size, props.animate, props.metalness, props.roughness, props.texture, props.bevel, props.opacity]);

  useThreeInteraction(meshRef, {
    styles: { opacity: icon.opacity },
    className: 'tjscube-mesh',
    onClick: (event) => console.log('Mesh clicked', event),
    onHover: (hovered) => console.log('Mesh hovered:', hovered),
  });

  useEffect(() => {
    const lightExists = scene.children.some(child => child instanceof THREE.AmbientLight);
    if (!lightExists) {
      const ambientLight = new THREE.AmbientLight(0xFFFFFF);
      scene.add(ambientLight);
      return () => {
        scene.remove(ambientLight);
      };
    }
  }, [scene, icon, ]);

  useEffect(() => {
    const materialOptions: THREE.MeshStandardMaterialParameters = {
      color: icon.color || '#ffffff',
      metalness: icon.metalness || 0,
      roughness: icon.roughness || 0,
      opacity: icon.opacity || 1,
      transparent: Boolean(icon?.opacity && icon.opacity < 1) || false,
    };
    const applyTexture = (material:any, texturePath:string) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(texturePath, (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(0.005, 0.005);
        material.map = texture;
        material.needsUpdate = true;
      });
    };
    if (!meshRef.current) {
      const iconObj = IconHelper.getIcon(icon.icon);
      if (!iconObj || !iconObj.html) return;

      const svgMarkup = iconObj.html.replace(/currentColor/g, icon.color || '#000000');
      const loader = new SVGLoader();
      const svgResult = loader.parse(svgMarkup);
      const paths = svgResult.paths.flatMap(path => path.toShapes(true));

      const geometry = new THREE.ExtrudeGeometry(paths, {
        depth: icon.size.z,
        bevelEnabled: icon.bevel?.bevelEnabled || false,
        bevelThickness: icon.bevel?.bevelThickness || 0,
        bevelSize: icon.bevel?.bevelSize || 0,
        bevelOffset: icon.bevel?.bevelOffset || 0,
        bevelSegments: icon.bevel?.bevelSegments || 0,
      });

      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox?.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      const material = new THREE.MeshStandardMaterial(materialOptions);
      if (icon.texture) applyTexture(material, icon.texture);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI;
      scene.add(mesh);
      meshRef.current = mesh;
      const maxDimension = Math.max(icon.size?.x || 0, icon.size?.y || 0, icon.size?.z || 0);
      camera.position.set(0, 0, maxDimension);

      // Add particles
      const particleMaterial = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.1,
      });

      // const particleGeometry = new THREE.BufferGeometry();
      const particles = [];
      for (let i = 0; i < 1000; i++) {
        particles.push(
          (Math.random() - 0.5) * 2 * icon.size.x,
          (Math.random() - 0.5) * 2 * icon.size.y,
          (Math.random() - 0.5) * 2 * icon.size.z
        );
      }
      // particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));
      // const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
      // scene.add(particleSystem);
      // particlesRef.current = particleSystem;
    } else {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.color.set(icon.color || '#ffffff');
      material.metalness = icon.metalness || 0;
      material.roughness = icon.roughness || 0;
      material.opacity = icon.opacity || 1;
      material.transparent = Boolean(icon?.opacity && icon.opacity < 1) || false;
      if (icon.texture) applyTexture(material, icon.texture);
      material.needsUpdate = true;
    }
  }, [icon, scene]);

  useFrame(() => {
    if (icon.animate?.rotate && meshRef.current) {
      const { x = 0, y = 0, z = 0, speed } = icon.animate.rotate;
      meshRef.current.rotation.x += x * speed;
      meshRef.current.rotation.y += y * speed;
      meshRef.current.rotation.z += z * speed;
    }

    // Animate particles
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.001;
    }
  });

  return null;
};

export const TJSCube: React.FC<ITJSCubeContent> = (props) => {
  const instanceRef = useRef<HTMLDivElement>(null);
  const bg = typeof props.icon === 'object' && props.icon !== null && 'backgroundColor' in props.icon
    ? String(props.icon.backgroundColor)
    : String(props.backgroundColor) || undefined;

  useEffect(() => {
    if (instanceRef.current && bg) instanceRef.current.style.backgroundColor = bg;
  }, [instanceRef, bg]);

  return <>
    <style jsx>{styles}</style>
    <div className='tjscube' ref={instanceRef}>
      <Canvas className='tjscube--content'>
        <OrbitControls />
        <TJSCubeContent {...props} />
      </Canvas>
    </div>
  </>;
}
