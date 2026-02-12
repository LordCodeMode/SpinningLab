/**
 * InfiniteScroller - Shared logic for infinite scrolling/recycling objects
 */

export class InfiniteScroller {
  /**
   * Update an array of objects with infinite scrolling behavior
   * @param {Array} objects - Array of THREE.Object3D items
   * @param {number} totalDistance - Current world distance traveled
   * @param {Object} options - Configuration options
   * @param {number} options.recycleDistance - Distance behind camera to recycle
   * @param {number} options.aheadDistance - Distance ahead to place recycled objects
   * @param {Function} options.onRecycle - Callback when object is recycled (object, newBaseZ)
   * @param {Function} options.onUpdate - Callback to update object position (object, relativeZ)
   */
  static updateObjects(objects, totalDistance, options) {
    const {
      recycleDistance = 100,
      aheadDistance = 1200,
      onRecycle = null,
      onUpdate = null
    } = options;

    objects.forEach(obj => {
      // Initialize baseZ if not set
      if (obj.userData.baseZ === undefined) {
        obj.userData.baseZ = obj.position.z;
      }

      const relativeZ = obj.userData.baseZ - totalDistance;

      // Recycle if too far behind
      if (relativeZ < -recycleDistance) {
        obj.userData.baseZ += aheadDistance;
        if (onRecycle) {
          onRecycle(obj, obj.userData.baseZ);
        }
      }

      // Update display position
      const newRelativeZ = obj.userData.baseZ - totalDistance;
      obj.position.z = newRelativeZ;

      if (onUpdate) {
        onUpdate(obj, newRelativeZ);
      }
    });
  }

  /**
   * Update instanced mesh with infinite scrolling
   * @param {THREE.InstancedMesh} instancedMesh - The instanced mesh
   * @param {Array} basePositions - Array of base Z positions (stored in userData)
   * @param {number} totalDistance - Current world distance
   * @param {Object} options - Configuration options
   */
  static updateInstanced(instancedMesh, basePositions, totalDistance, options) {
    const {
      recycleDistance = 50,
      aheadDistance = 1200,
      dummy = null
    } = options;

    const dummyObj = dummy || new (require('three').Object3D)();

    for (let i = 0; i < basePositions.length; i++) {
      let relZ = basePositions[i] - totalDistance;

      if (relZ < -recycleDistance) {
        basePositions[i] += aheadDistance;
        relZ = basePositions[i] - totalDistance;
      }

      instancedMesh.getMatrixAt(i, dummyObj.matrix);
      dummyObj.matrix.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);
      dummyObj.position.z = relZ;
      dummyObj.updateMatrix();
      instancedMesh.setMatrixAt(i, dummyObj.matrix);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Initialize an object's base position for scrolling
   * @param {THREE.Object3D} obj - The object to initialize
   * @param {Object} defaults - Default values to store
   */
  static initObject(obj, defaults = {}) {
    if (obj.userData.baseZ === undefined) {
      obj.userData.baseZ = obj.position.z;
    }
    if (defaults.baseX !== undefined && obj.userData.baseX === undefined) {
      obj.userData.baseX = defaults.baseX;
    }
    if (defaults.baseY !== undefined && obj.userData.baseY === undefined) {
      obj.userData.baseY = defaults.baseY;
    }
    Object.entries(defaults).forEach(([key, value]) => {
      if (obj.userData[key] === undefined) {
        obj.userData[key] = value;
      }
    });
  }
}
