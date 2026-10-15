/**
 * Cena 3D da caneca. Este é o único módulo que importa o three.js: ele só é
 * carregado (import dinâmico) quando o usuário abre "Ver em 3D", para não pesar
 * no carregamento do app nem gastar bateria com renderização contínua.
 */
import {
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
  type Material,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { MugShape } from "./mugShape";

const SEGMENTS = 128;
const CERAMIC = { color: new Color("#ffffff"), roughness: 0.28, metalness: 0 };

export interface MugViewer {
  dispose: () => void;
}

/**
 * Monta a caneca dentro de `container` com a arte (`art`, sem espelhamento)
 * enrolada na parede, centralizada do lado oposto à alça. Unidades em cm.
 */
export function createMugViewer(container: HTMLElement, art: HTMLCanvasElement, shape: MugShape, artHeightMm: number): MugViewer {
  const radius = shape.diameterMm / 20;
  const height = shape.heightMm / 10;
  const wall = 0.3;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  const light = new DirectionalLight("#ffffff", 0.8);
  light.position.set(4, 8, 6);
  scene.add(light);

  const ceramic = new MeshStandardMaterial(CERAMIC);
  const ceramicBothSides = new MeshStandardMaterial({ ...CERAMIC, side: DoubleSide });
  const texture = new CanvasTexture(art);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const printed = new MeshStandardMaterial({ ...CERAMIC, map: texture });

  const mug = new Group();
  scene.add(mug);
  const add = (mesh: Mesh) => {
    mug.add(mesh);
    return mesh;
  };

  // Parede: lado de fora, lado de dentro, borda e fundos.
  add(new Mesh(new CylinderGeometry(radius, radius, height, SEGMENTS, 1, true), ceramic));
  add(new Mesh(new CylinderGeometry(radius - wall, radius - wall, height, SEGMENTS, 1, true), ceramicBothSides));
  const rim = add(new Mesh(new RingGeometry(radius - wall, radius, SEGMENTS), ceramic));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = height / 2;
  const bottom = add(new Mesh(new CircleGeometry(radius, SEGMENTS), ceramicBothSides));
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -height / 2;
  const innerBottom = add(new Mesh(new CircleGeometry(radius - wall, SEGMENTS), ceramic));
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = -height / 2 + wall;

  // Arte: faixa um pouco acima da parede, com o centro virado para a câmera (+z)
  // e a abertura atrás, na alça. O u do cilindro cresce da esquerda para a direita.
  const thetaLength = 2 * Math.PI * shape.wrap;
  add(
    new Mesh(
      new CylinderGeometry(radius * 1.002, radius * 1.002, artHeightMm / 10, SEGMENTS, 1, true, -thetaLength / 2, thetaLength),
      printed,
    ),
  );

  // Alça: meio toro em pé, preso na parede de trás (−z).
  const handle = add(new Mesh(new TorusGeometry(height * 0.3, height * 0.055, 24, 64, Math.PI), ceramic));
  handle.rotation.set(0, Math.PI / 2, -Math.PI / 2);
  handle.position.z = -radius + height * 0.02;

  const size = Math.max(height, 2 * radius + height * 0.35);
  const distance = size * 2.6;
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  // De frente, levemente de cima: o centro da arte começa virado para o cliente.
  camera.position.set(0, height * 0.35, distance);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = distance * 0.55;
  controls.maxDistance = distance * 1.6;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.8;

  const resize = () => {
    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // O laço só existe enquanto a visualização está aberta (dispose o encerra).
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      const materials = new Set<Material>();
      mug.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          materials.add(object.material as Material);
        }
      });
      materials.forEach((material) => material.dispose());
      texture.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
