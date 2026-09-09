import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera, useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from 'gsap';
import styles from './ThreeGLB.scss';

interface GLBViewerProps {
  /** Optional overlay content rendered on top of the canvas. */
  children?: any;
  /** URL or path to the .glb model file. */
  modelPath: string;
  /** Render meshes as wireframe. */
  wireframe?: boolean;
  /** Color applied to mesh materials when `wireframe` is true. */
  wireframeColor?: string;
  /** Camera field of view in degrees. Default: 55. */
  fov?: number;
  /** Container width (CSS value). Default: '100%'. */
  width?: number | string;
  /** Container height (CSS value). Default: '100%'. */
  height?: number | string;
  /** Animate camera into final position on mount. Default: true. */
  animate?: boolean;
  /** Enable OrbitControls. Default: true. */
  controls?: boolean;
  /** drei Environment preset for lighting. Default: 'city'. */
  envPreset?: React.ComponentProps<typeof Environment>['preset'];
}

useGLTF.preload('/merchant/nirv1/3dModels/products/MetalBox.glb');

function fitCameraToObject(camera: THREE.PerspectiveCamera, obj: THREE.Object3D, fovDeg: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Re-center model at origin for stable controls
  obj.position.sub(center);

  const radius = 0.5 * Math.max(size.x, size.y, size.z);
  const fov = (fovDeg * Math.PI) / 180;
  const dist = radius / Math.sin(fov / 2); // generous fit

  camera.position.set(0, 0, dist);
  camera.near = Math.max(0.01, dist - radius * 4);
  camera.far = dist + radius * 8;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  return { dist, radius };
}

const Model: React.FC<{ gltf: any; fov: number; animate?: boolean }> = ({ gltf, fov, animate }) => {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!ref.current) return;
    const { dist } = fitCameraToObject(camera as THREE.PerspectiveCamera, ref.current, fov);

    if (animate) {
      const start = { x: -dist * 0.6, y: -dist * 0.4, z: dist * 1.1 };
      camera.position.set(start.x, start.y, start.z);
      gsap.to(camera.position, {
        x: 0, y: 0, z: dist,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => camera.lookAt(0, 0, 0),
      });
    }
  }, [gltf, camera, fov, animate]);

  return <primitive ref={ref} object={gltf.scene} />;
};

/**
 * Renders a .glb 3D model in a react-three-fiber Canvas with optional
 * wireframe mode, OrbitControls, and an overlay `children` layer.
 *
 * @param props - {@link GLBViewerProps}
 */
function GLBViewer({
  width = '100%',
  children,
  height = '100%',
  modelPath,
  wireframe = false,
  wireframeColor,
  fov = 55,
  animate = true,
  controls = true,
  envPreset = 'city',
}: GLBViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState(modelPath);
  const [exists, setExists] = useState(true);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl') || (c.getContext('experimental-webgl') as WebGLRenderingContext | null);
      setWebglOk(!!gl);
    } catch {
      setWebglOk(false);
    }
  }, []);

  // Validate path once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(modelPath, { method: 'HEAD' });
        if (!res.ok) throw new Error();
        setExists(true);
        setCurrentPath(modelPath);
      } catch {
        setExists(false);
        setCurrentPath('/merchant/nirv1/3dModels/products/MetalBox.glb');
      }
    })();
  }, [modelPath]);

  const gltf = useGLTF(currentPath);

  // Optional runtime wireframe toggle (will traverse once)
  useEffect(() => {
    if (!gltf?.scene) return;
    gltf.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((m: THREE.Material) => {
          const mat = m as THREE.MeshStandardMaterial;
          if (!mat) return;
          mat.wireframe = wireframe;
          if (wireframe && 'color' in mat) (mat as THREE.MeshStandardMaterial).color = new THREE.Color(wireframeColor);
          mat.needsUpdate = true;
        });
      }
    });
  }, [gltf, wireframe, wireframeColor]);

  return (<>
    <div ref={containerRef} style={{ width, height, position: 'relative' }}>
      <style jsx>{styles}</style>
      {!webglOk ? (
        <div>3D unavailable: WebGL is disabled in this browser.</div>
      ) : exists ? (
        <Canvas
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]}
        shadows
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0);                   // transparent canvas
          gl.outputColorSpace = THREE.SRGBColorSpace;      // correct color
          gl.toneMapping = THREE.ACESFilmicToneMapping;    // nicer PBR response
          scene.environmentIntensity = 1.0 as any;
        }}
        >
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault fov={fov} position={[0, 0, 3]} />
            <Environment preset={envPreset} />
            {controls && <OrbitControls enableDamping dampingFactor={0.08} />}
            <Model gltf={gltf} fov={fov} animate={animate} />
          </Suspense>
        </Canvas>
      ) : (
        <div>No GLB model found</div>
      )}
    </div>
    <div style={{position:"absolute", top: "0",left:"0",zIndex:"2", width:"100%",height:"100%"}}>
    {children}
</div>
      </>
  );
}

export default GLBViewer;
