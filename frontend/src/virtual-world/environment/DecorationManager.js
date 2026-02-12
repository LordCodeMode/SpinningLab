/**
 * DecorationManager - KM markers, road signs, cones, banners
 */

import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, VISIBLE_SEGMENTS, ALT_SCALE } from '../scene-config.js';

export class DecorationManager {
  constructor(scene) {
    this.scene = scene;
    this.decorations = [];
    this.cones = [];
    this.banners = [];
    this.routeLength = 20000;
    this.sceneryLevel = 'standard';
  }

  create(routeLength) {
    this.routeLength = routeLength || 20000;
    this.createKmMarkers();
    this.createRoadSigns();
    this.createTrafficCones();
    this.createBanners();
  }

  createKmMarkers() {
    const maxKm = Math.max(1, Math.floor(this.routeLength / 1000));
    for (let km = 1; km <= maxKm; km++) {
      const marker = this.createKmMarker(km);
      marker.position.set(ROAD_WIDTH / 2 + 8, 0, km * 1000);
      marker.userData.baseZ = marker.position.z;
      marker.userData.baseX = marker.position.x;
      marker.userData.baseY = marker.position.y;
      marker.userData.baseYaw = marker.rotation.y;
      this.scene.add(marker);
      this.decorations.push(marker);
    }
  }

  createKmMarker(km) {
    const group = new THREE.Group();

    // Post
    const postGeo = new THREE.BoxGeometry(0.15, 1.2, 0.15);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 0.6;
    post.castShadow = true;
    group.add(post);

    // Sign
    const signGeo = new THREE.BoxGeometry(0.6, 0.4, 0.05);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x2255aa });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 1.1, 0.1);
    group.add(sign);

    return group;
  }

  createRoadSigns() {
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 10);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.7 });
    const signGeo = new THREE.BoxGeometry(0.7, 0.5, 0.06);
    const signMats = [
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 })
    ];

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    for (let z = 200; z < maxDistance; z += 450) {
      if (Math.random() < 0.3) continue;

      const signGroup = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 0.8;
      pole.castShadow = true;
      const sign = new THREE.Mesh(signGeo, signMats[Math.floor(Math.random() * signMats.length)]);
      sign.position.set(0, 1.25, 0);
      sign.castShadow = true;
      signGroup.add(pole, sign);

      const side = Math.random() > 0.5 ? 1 : -1;
      signGroup.position.set(side * (ROAD_WIDTH / 2 + 10), 0, z + Math.random() * 120);
      signGroup.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      signGroup.userData.baseZ = signGroup.position.z;
      signGroup.userData.baseX = signGroup.position.x;
      signGroup.userData.baseY = signGroup.position.y;
      signGroup.userData.baseYaw = signGroup.rotation.y;
      this.scene.add(signGroup);
      this.decorations.push(signGroup);
    }
  }

  createTrafficCones() {
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
    const coneGeo = new THREE.ConeGeometry(0.18, 0.4, 12);
    const bandGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.05, 12);

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    for (let z = 80; z < maxDistance; z += 140) {
      if (Math.random() < 0.6) continue;

      const cone = new THREE.Group();
      const body = new THREE.Mesh(coneGeo, coneMat);
      body.position.y = 0.2;
      body.castShadow = true;
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.25;
      cone.add(body, band);
      cone.position.set(-ROAD_WIDTH / 2 - 2.0 + Math.random() * 0.8, 0, z + Math.random() * 50);
      cone.userData.baseZ = cone.position.z;
      cone.userData.baseX = cone.position.x;
      cone.userData.baseY = cone.position.y;
      cone.userData.baseYaw = cone.rotation.y;
      this.scene.add(cone);
      this.cones.push(cone);
    }
  }

  createBanners() {
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 10);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.7 });
    const bannerGeo = new THREE.PlaneGeometry(2.6, 0.9);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    for (let z = 300; z < maxDistance; z += 600) {
      if (Math.random() < 0.4) continue;

      const bannerGroup = new THREE.Group();
      const leftPole = new THREE.Mesh(poleGeo, poleMat);
      const rightPole = new THREE.Mesh(poleGeo, poleMat);
      leftPole.position.set(-1.4, 1.3, 0);
      rightPole.position.set(1.4, 1.3, 0);
      leftPole.castShadow = true;
      rightPole.castShadow = true;

      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0, 1.6, 0);
      banner.rotation.y = Math.PI;
      banner.castShadow = true;

      bannerGroup.add(leftPole, rightPole, banner);
      bannerGroup.position.set(ROAD_WIDTH / 2 + 6, 0, z);
      bannerGroup.rotation.y = Math.PI / 2;
      bannerGroup.userData.baseZ = bannerGroup.position.z;
      bannerGroup.userData.baseX = bannerGroup.position.x;
      bannerGroup.userData.baseY = bannerGroup.position.y;
      bannerGroup.userData.baseYaw = bannerGroup.rotation.y;
      this.scene.add(bannerGroup);
      this.banners.push(bannerGroup);
    }
  }

  resetKmMarkers(routeLength) {
    // Remove existing km markers
    this.decorations.forEach(marker => this.scene.remove(marker));
    this.decorations = [];

    this.routeLength = routeLength;
    this.createKmMarkers();
  }

  setDetailLevel(level) {
    const showProps = level === 'high';
    const showDecos = level !== 'low';

    this.cones.forEach(cone => { cone.visible = showProps; });
    this.banners.forEach(banner => { banner.visible = showProps; });
    this.decorations.forEach(deco => { deco.visible = showDecos; });
  }

  setSceneryLevel(level = 'standard') {
    this.sceneryLevel = level;
    const showProps = level !== 'low';
    const showDecos = level !== 'low';
    this.cones.forEach(cone => { cone.visible = showProps; });
    this.banners.forEach(banner => { banner.visible = showProps; });
    this.decorations.forEach(deco => { deco.visible = showDecos; });
  }

  update(deltaTime, worldState) {
    const { totalDistance, currentAltitude, getElevationAt, routeManager } = worldState;
    const aheadDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    // Update decorations (km markers, signs)
    this.decorations.forEach(deco => {
      if (deco.userData.baseZ === undefined) {
        deco.userData.baseZ = deco.position.z;
        deco.userData.baseX = deco.position.x;
        deco.userData.baseY = deco.position.y || 0;
        deco.userData.baseYaw = deco.rotation.y || 0;
      }

      const relativeZ = deco.userData.baseZ - totalDistance;

      if (relativeZ < -50) {
        deco.userData.baseZ += this.routeLength;
      }

      const distance = deco.userData.baseZ;
      const curve = routeManager?.getCurveInfo(distance) || { lateral: 0, heading: 0 };
      const altitude = getElevationAt ? getElevationAt(distance).altitude : 0;

      deco.position.z = distance - totalDistance;
      deco.position.x = curve.lateral + (deco.userData.baseX || 0);
      deco.position.y = (altitude - currentAltitude) * ALT_SCALE + (deco.userData.baseY || 0);
      deco.rotation.y = curve.heading + (deco.userData.baseYaw || 0);
    });

    // Update cones
    this.cones.forEach(cone => {
      if (cone.userData.baseZ === undefined) {
        cone.userData.baseZ = cone.position.z;
        cone.userData.baseX = cone.position.x;
        cone.userData.baseY = cone.position.y || 0;
        cone.userData.baseYaw = cone.rotation.y || 0;
      }

      const relativeZ = cone.userData.baseZ - totalDistance;

      if (relativeZ < -60) {
        cone.userData.baseZ += aheadDistance;
      }

      const distance = cone.userData.baseZ;
      const curve = routeManager?.getCurveInfo(distance) || { lateral: 0, heading: 0 };
      const altitude = getElevationAt ? getElevationAt(distance).altitude : 0;

      cone.position.z = distance - totalDistance;
      cone.position.x = curve.lateral + (cone.userData.baseX || 0);
      cone.position.y = (altitude - currentAltitude) * ALT_SCALE + (cone.userData.baseY || 0);
      cone.rotation.y = curve.heading + (cone.userData.baseYaw || 0);
    });

    // Update banners
    this.banners.forEach(banner => {
      if (banner.userData.baseZ === undefined) {
        banner.userData.baseZ = banner.position.z;
        banner.userData.baseX = banner.position.x;
        banner.userData.baseY = banner.position.y || 0;
        banner.userData.baseYaw = banner.rotation.y || 0;
      }

      const relativeZ = banner.userData.baseZ - totalDistance;

      if (relativeZ < -80) {
        banner.userData.baseZ += aheadDistance;
      }

      const distance = banner.userData.baseZ;
      const curve = routeManager?.getCurveInfo(distance) || { lateral: 0, heading: 0 };
      const altitude = getElevationAt ? getElevationAt(distance).altitude : 0;

      banner.position.z = distance - totalDistance;
      banner.position.x = curve.lateral + (banner.userData.baseX || 0);
      banner.position.y = (altitude - currentAltitude) * ALT_SCALE + (banner.userData.baseY || 0);
      banner.rotation.y = curve.heading + (banner.userData.baseYaw || 0);
    });
  }

  destroy() {
    const allObjects = [...this.decorations, ...this.cones, ...this.banners];
    allObjects.forEach(obj => {
      this.scene.remove(obj);
      obj.traverse?.(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });

    this.decorations = [];
    this.cones = [];
    this.banners = [];
  }
}
