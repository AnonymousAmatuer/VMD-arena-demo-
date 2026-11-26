"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { renderRig, workshopEnvironment } from "@/game/rendering";
import { partModel, animatePart, disposeTree } from "@/game/models";
import {
  DEF,
  extents,
  type MountHit,
  type Part,
  type Quality,
  type V3,
} from "@/game/data";
import type { SurfacePicker } from "./useSurfaceDrag";
import {
  applyLivery,
  createIdentityPanel,
  disposeIdentityPanel,
  pulseLights,
} from "@/game/livery";
import type { Livery } from "@/game/data";

interface Props {
  parts: Part[];
  floorParts: Part[];
  preview: Part[];
  mount: MountHit | null;
  invalid: boolean;
  dragging: boolean;
  selected: string | null;
  quality: Quality;
  onPick: (hit: MountHit) => void;
  onPrepareDrag: (
    event: PointerEvent,
    hit: MountHit | null,
    canvas: HTMLCanvasElement,
  ) => boolean;
  onCancelDrag: () => void;
  picker: RefObject<SurfacePicker | null>;
  livery?: Livery;
  focus: number;
  zoom: number;
  com: V3;
  showCom: boolean;
  showLinks: boolean;
}
const GREEN = 0x76ffce,
  RED = 0xfe675d;
const radians = (d: number) => (d * Math.PI) / 180;

export default function WorkshopCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const sync = useRef<() => void>(() => {});
  useEffect(() => {
    if (!host.current) return;
    const rig = renderRig(host.current, latest.current.quality),
      { scene, camera, canvas } = rig;
    workshopEnvironment(scene);
    const controls = new OrbitControls(camera, canvas);
    function center() {
      const compact = camera.aspect < 1.35;
      camera.position.set(
        compact ? 4.9 : 4.05,
        compact ? 3.55 : 2.65,
        compact ? -7.1 : -5.18,
      );
      controls.target.set(0, 0.93, 0);
      controls.update();
    }
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.496;
    controls.minDistance = 3.2;
    controls.maxDistance = 22;
    controls.enablePan = false;
    center();
    const assembly = new T.Group(),
      previews = new T.Group(),
      overlays = new T.Group();
    scene.add(assembly, previews, overlays);
    const comGroup = new T.Group();
    overlays.add(comGroup);
    const comMat = new T.MeshBasicMaterial({
      color: 0xf0b072,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const comSphere = new T.Mesh(new T.SphereGeometry(0.095, 16, 10), comMat);
    comSphere.renderOrder = 20;
    comGroup.add(comSphere);
    for (const size of [0.55, 0.78]) {
      const ring = new T.Mesh(
        new T.RingGeometry(size, size + 0.014, 36),
        new T.MeshBasicMaterial({
          color: 0xf0b072,
          side: T.DoubleSide,
          depthTest: false,
          transparent: true,
          opacity: size === 0.55 ? 0.55 : 0.26,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 19;
      comGroup.add(ring);
    }
    const linkPositions = new Float32Array(60 * 2 * 3),
      linkGeometry = new T.BufferGeometry();
    linkGeometry.setAttribute(
      "position",
      new T.BufferAttribute(linkPositions, 3),
    );
    const linkLines = new T.LineSegments(
      linkGeometry,
      new T.LineBasicMaterial({
        color: 0x83d2b4,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
      }),
    );
    linkLines.frustumCulled = false;
    linkLines.renderOrder = 18;
    overlays.add(linkLines);
    const modelById = new Map<string, T.Group>();
    const previewById = new Map<string, T.Group>();
    const mounts: T.Mesh[] = [];
    const previewMounts: T.Mesh[] = [];
    const proxyGeo = new T.BoxGeometry(1, 1, 1),
      proxyMat = new T.MeshBasicMaterial();
    const ghost = new T.MeshStandardMaterial({
      color: GREEN,
      emissive: 0x14604c,
      transparent: true,
      opacity: 0.51,
      depthWrite: false,
    });
    const bounds = new T.Box3(),
      wire = new T.Box3Helper(bounds, GREEN);
    wire.visible = false;
    scene.add(wire);
    const attachGeo = new T.OctahedronGeometry(0.065, 0),
      attachMat = new T.MeshBasicMaterial({
        color: 0x8ff0cb,
        depthTest: false,
      });
    const attachPoint = new T.Mesh(attachGeo, attachMat);
    attachPoint.renderOrder = 21;
    attachPoint.visible = false;
    overlays.add(attachPoint);
    const reticleGeo = new T.RingGeometry(0.14, 0.178, 28);
    const reticleMat = new T.MeshBasicMaterial({
      color: GREEN,
      side: T.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const reticle = new T.Mesh(reticleGeo, reticleMat);
    reticle.renderOrder = 10;
    reticle.visible = false;
    scene.add(reticle);
    const normal = new T.Vector3(),
      zAxis = new T.Vector3(0, 0, 1);
    let raf = 0,
      last = performance.now(),
      lastFocus = latest.current.focus,
      lastZoom = latest.current.zoom;
    let lastParts: Part[] | null = null,
      lastFloor: Part[] | null = null,
      floorHeight = 0.8;
    let lastLivery = "";
    let identityPanel: T.Group | null = null;

    function applyPose(object: T.Object3D, p: Part, y = 0) {
      object.position.set(p.pos[0], p.pos[1] + y, p.pos[2]);
      object.rotation.set(
        radians(p.rot[0]),
        radians(p.rot[1]),
        radians(p.rot[2]),
      );
      object.scale.set(...p.scale);
    }
    function updateModels(
      map: Map<string, T.Group>,
      group: T.Group,
      parts: Part[],
      overlay = false,
    ) {
      const ids = new Set(parts.map((p) => p.id));
      for (const [id, model] of map)
        if (!ids.has(id)) {
          group.remove(model);
          disposeTree(model);
          map.delete(id);
        }
      for (const p of parts) {
        let model = map.get(p.id);
        if (!model || model.userData.partKey !== p.key) {
          if (model) {
            group.remove(model);
            disposeTree(model);
          }
          model = partModel(p);
          applyLivery(model, latest.current.livery);
          model.traverse((c) => {
            if (c instanceof T.Mesh) {
              c.userData.fallback = true;
              if (overlay) c.material = ghost;
            }
          });
          map.set(p.id, model);
          group.add(model);
        }
        applyPose(model, p);
      }
    }
    function updateProxies(list: T.Mesh[], parts: Part[]) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const proxy = list[i] ?? (list[i] = new T.Mesh(proxyGeo, proxyMat));
        proxy.userData.partId = p.id;
        applyPose(proxy, p, floorHeight);
        const [w, h, l] = DEF[p.key].dimensions;
        proxy.scale.set(p.scale[0] * w, p.scale[1] * h, p.scale[2] * l);
        proxy.updateMatrixWorld(true);
      }
      list.length = parts.length;
    }
    sync.current = () => {
      const { parts, floorParts, preview, mount, selected, invalid } =
        latest.current;
      if (floorParts !== lastFloor) {
        floorHeight = Math.max(
          0.46,
          ...floorParts.map((p) => extents(p)[1] - p.pos[1] + 0.022),
        );
        assembly.position.y = previews.position.y = floorHeight;
        lastFloor = floorParts;
        lastParts = null;
      }
      const liveryKey = JSON.stringify(latest.current.livery);
      if (liveryKey !== lastLivery) {
        if (identityPanel) {
          assembly.remove(identityPanel);
          disposeIdentityPanel(identityPanel);
        }
        if (latest.current.livery) {
          identityPanel = createIdentityPanel(latest.current.livery);
          assembly.add(identityPanel);
        } else identityPanel = null;
        lastLivery = liveryKey;
        lastParts = null;
      }
      if (parts !== lastParts) {
        updateModels(modelById, assembly, parts);
        updateProxies(mounts, parts);
        lastParts = parts;
      }
      updateModels(previewById, previews, preview, true);
      updateProxies(previewMounts, preview);
      const color = invalid ? RED : GREEN;
      ghost.color.setHex(color);
      ghost.emissive.setHex(invalid ? 0x7c1412 : 0x14604c);
      (wire.material as T.LineBasicMaterial).color.setHex(color);
      wire.visible = false;
      if (preview.length) {
        previews.updateMatrixWorld(true);
        bounds.setFromObject(previews);
        wire.visible = !bounds.isEmpty();
      } else if (selected && modelById.has(selected)) {
        assembly.updateMatrixWorld(true);
        bounds.setFromObject(modelById.get(selected)!);
        wire.visible = !bounds.isEmpty();
      }
      reticle.visible = !!mount;
      const chosen =
        !mount && !preview.length && selected
          ? parts.find((p) => p.id === selected)
          : null;
      attachPoint.visible = !!chosen;
      if (chosen) {
        attachPoint.position.set(chosen.pos[0], chosen.pos[1], chosen.pos[2]);
        attachPoint.rotation.y += 0.03;
      }
      const { com, showCom, showLinks } = latest.current;
      overlays.position.y = floorHeight;
      comGroup.visible = showCom;
      comGroup.position.set(com[0], com[1], com[2]);
      linkLines.visible = showLinks;
      if (showLinks) {
        let at = 0;
        for (const p of parts) {
          if (!p.parent) continue;
          const anchor = parts.find((q) => q.id === p.parent);
          if (!anchor) continue;
          linkPositions.set(
            [
              p.pos[0],
              p.pos[1],
              p.pos[2],
              anchor.pos[0],
              anchor.pos[1],
              anchor.pos[2],
            ],
            at,
          );
          at += 6;
          if (at >= linkPositions.length) break;
        }
        for (let i = at; i < linkPositions.length; i++) linkPositions[i] = 0;
        linkGeometry.attributes.position.needsUpdate = true;
        linkGeometry.computeBoundingSphere();
      }
      if (mount) {
        reticleMat.color.setHex(color);
        reticle.position.set(
          mount.point[0],
          mount.point[1] + floorHeight,
          mount.point[2],
        );
        normal.set(...mount.normal);
        reticle.position.addScaledVector(normal, 0.027);
        reticle.quaternion.setFromUnitVectors(zAxis, normal);
      }
    };
    sync.current();
    const ray = new T.Raycaster(),
      pointer = new T.Vector2();
    const pick: SurfacePicker = (x, y, ignored) => {
      const r = canvas.getBoundingClientRect();
      if (
        x < r.left ||
        x > r.right ||
        y < r.top ||
        y > r.bottom ||
        !r.width ||
        !r.height
      )
        return null;
      pointer.set(
        ((x - r.left) / r.width) * 2 - 1,
        1 - ((y - r.top) / r.height) * 2,
      );
      camera.updateMatrixWorld();
      ray.setFromCamera(pointer, camera);
      const hit = ray
        .intersectObjects(mounts, false)
        .find((x) => !ignored?.has(x.object.userData.partId));
      if (!hit?.face) return null;
      const n = hit.face.normal;
      const face =
        n.x < -0.5
          ? "Left"
          : n.x > 0.5
            ? "Right"
            : n.y < -0.5
              ? "Bottom"
              : n.y > 0.5
                ? "Top"
                : n.z < 0
                  ? "Front"
                  : "Rear";
      return {
        id: hit.object.userData.partId,
        face,
        point: [hit.point.x, hit.point.y - floorHeight, hit.point.z],
        normal: n.clone().applyQuaternion(hit.object.quaternion).toArray(),
      };
    };
    const picker = latest.current.picker;
    picker.current = pick;
    let press: { id: number; x: number; y: number; tool: boolean } | null =
      null;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary) {
        if (press?.tool && e.pointerType === "touch") {
          latest.current.onCancelDrag();
          press = null;
          controls.enabled = true;
        }
        return;
      }
      if (e.button !== 0 || latest.current.dragging) return;
      const hit = pick(e.clientX, e.clientY);
      // `pick` sets the ray once. Preview proxies can be grabbed, but are
      // never eligible for the attachment raycast used in a drop.
      const onPreview =
        previewMounts.length > 0 &&
        ray.intersectObjects(previewMounts, false).length > 0;
      const tool =
        (!!hit || onPreview) && latest.current.onPrepareDrag(e, hit, canvas);
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, tool };
      if (tool) controls.enabled = false;
    };
    const clearPress = (e: PointerEvent) => {
      if (e.pointerId === press?.id) {
        press = null;
        controls.enabled = true;
      }
    };
    const up = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      if (
        Math.hypot(e.clientX - press.x, e.clientY - press.y) <
          (e.pointerType === "touch" ? 8 : 6) &&
        !latest.current.dragging
      ) {
        const hit = pick(e.clientX, e.clientY);
        if (hit) latest.current.onPick(hit);
      }
      clearPress(e);
    };
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", clearPress);
    canvas.addEventListener("lostpointercapture", clearPress);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const n = performance.now(),
        dt = Math.min((n - last) / 1000, 0.18);
      last = n;
      if (document.hidden || document.querySelector(".modal-backdrop")) return;
      if (lastFocus !== latest.current.focus) {
        center();
        lastFocus = latest.current.focus;
      }
      if (lastZoom !== latest.current.zoom) {
        camera.position
          .sub(controls.target)
          .multiplyScalar(latest.current.zoom > lastZoom ? 0.86 : 1.16)
          .add(controls.target);
        lastZoom = latest.current.zoom;
      }
      for (const model of modelById.values()) {
        animatePart(model, dt, 0, false);
        pulseLights(model, n);
      }
      if (!latest.current.dragging) controls.update();
      rig.render(dt);
    };
    draw();
    setReady(true);
    return () => {
      cancelAnimationFrame(raf);
      if (picker.current === pick) picker.current = null;
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", clearPress);
      canvas.removeEventListener("lostpointercapture", clearPress);
      controls.dispose();
      if (identityPanel) disposeIdentityPanel(identityPanel);
      disposeTree(assembly);
      disposeTree(previews);
      proxyGeo.dispose();
      proxyMat.dispose();
      ghost.dispose();
      wire.dispose();
      reticleGeo.dispose();
      reticleMat.dispose();
      rig.dispose();
    };
  }, [props.quality]);
  useEffect(
    () => sync.current(),
    [
      props.parts,
      props.floorParts,
      props.preview,
      props.mount,
      props.invalid,
      props.selected,
    ],
  );
  return (
    <div
      className="workshop-canvas"
      ref={host}
      aria-label="Interactive vehicle editor. Drag components to move them, drag the background to orbit, or scroll to zoom."
    >
      {!ready && <span className="canvas-loading">ASSEMBLING VIEWPORT…</span>}
    </div>
  );
}
