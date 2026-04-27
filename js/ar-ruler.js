class ARRuler {
    constructor() {
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.zIndex = '900';
        this.container.style.display = 'none';
        document.body.appendChild(this.container);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        let light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        this.reticle = new THREE.Object3D();

        // Outer ring (approx 15cm)
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x00D1FF, opacity: 0.8, transparent: true })
        );

        // Inner dot (approx 4cm)
        const dot = new THREE.Mesh(
            new THREE.CircleGeometry(0.02, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );

        this.reticle.add(ring);
        this.reticle.add(dot);

        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = false;
        this.scene.add(this.reticle);

        this.points = [];
        this.markers = [];

        // Array of {p1, p2, distanceMeters, midPoint, lineMesh, spriteMesh}
        this.measurements = [];

        this.hitTestSource = null;
        this.hitTestSourceRequested = false;

        this.controller = this.renderer.xr.getController(0);
        this.controller.addEventListener('select', this.onSelect.bind(this));
        this.scene.add(this.controller);

        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        this.session = null;

        document.getElementById('unit-cm').addEventListener('change', () => this.updateDistanceDisplay());
        document.getElementById('unit-ft').addEventListener('change', () => this.updateDistanceDisplay());
    }

    formatDist(meters, isCm) {
        if (isCm) {
            return (meters * 100).toFixed(2) + ' cm';
        } else {
            const totalInches = meters * 39.3701;
            const feet = Math.floor(totalInches / 12);
            const inches = (totalInches % 12).toFixed(1);
            return `${feet}' ${inches}"`;
        }
    }

    updateDistanceDisplay() {
        const isCm = document.getElementById('unit-cm').checked;

        // Update main text for the most recent measurement
        if (this.measurements.length === 0) {
            document.getElementById('ar-distance').textContent = isCm ? "0.00 cm" : "0' 0.0\"";
        } else {
            const lastM = this.measurements[this.measurements.length - 1];
            document.getElementById('ar-distance').textContent = this.formatDist(lastM.distanceMeters, isCm);
        }

        // Recreate all 3D floating sprites with the new chosen unit format
        this.measurements.forEach(m => {
            if (m.spriteMesh) {
                this.scene.remove(m.spriteMesh);
                m.spriteMesh = null;
            }

            const textStr = this.formatDist(m.distanceMeters, isCm);

            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const context = canvas.getContext('2d');

            context.font = 'Bold 60px Arial';
            context.fillStyle = 'white';
            context.strokeStyle = 'black';
            context.lineWidth = 4;
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            context.strokeText(textStr, 256, 64);
            context.fillText(textStr, 256, 64);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
            const sprite = new THREE.Sprite(spriteMaterial);

            sprite.scale.set(0.2, 0.05, 1);
            sprite.position.copy(m.midPoint);
            sprite.position.y += 0.02;

            this.scene.add(sprite);
            m.spriteMesh = sprite;
        });
    }

    onSelect() {
        if (this.reticle.visible) {
            const material = new THREE.MeshBasicMaterial({ color: 0x00D1FF });
            const geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.002, 32);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.setFromMatrixPosition(this.reticle.matrix);

            this.scene.add(mesh);
            this.markers.push(mesh);
            this.points.push(mesh.position.clone());

            if (this.points.length === 2) {
                // Draw line between the two clicked points
                const p1 = this.points[0];
                const p2 = this.points[1];

                const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
                const lineMat = new THREE.LineBasicMaterial({ color: 0x00D1FF, linewidth: 3 });
                const line = new THREE.Line(lineGeo, lineMat);
                this.scene.add(line);

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dz = p2.z - p1.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

                // Add to multi-line persistent history
                this.measurements.push({
                    p1: p1,
                    p2: p2,
                    distanceMeters: dist,
                    midPoint: mid,
                    lineMesh: line,
                    spriteMesh: null
                });

                this.updateDistanceDisplay();

                document.getElementById('ar-status').textContent = 'Measurement complete. Tap for next item.';
                this.points = [];

            } else if (this.points.length === 1) {
                document.getElementById('ar-status').textContent = 'Place second point...';
            }
        }
    }

    clearLines() {
        // Completely flush all lines and markers from memory and the 3D scene
        this.measurements.forEach(m => {
            if (m.lineMesh) this.scene.remove(m.lineMesh);
            if (m.spriteMesh) this.scene.remove(m.spriteMesh);
        });
        this.measurements = [];

        this.markers.forEach(m => this.scene.remove(m));
        this.markers = [];

        this.points = [];

        this.updateDistanceDisplay();
        document.getElementById('ar-status').textContent = 'Clean slate. Point camera at surface...';
    }

    reset() {
        this.clearLines();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    async start() {
        if (!navigator.xr) return false;

        try {
            const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!isSupported) return false;

            this.session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.getElementById('ui-container') }
            });

            this.session.addEventListener('end', () => {
                this.stop();
                if (document.getElementById('btn-back')) {
                    document.getElementById('btn-back').click(); // trigger back UI
                }
            });

            this.renderer.xr.setReferenceSpaceType('local');
            await this.renderer.xr.setSession(this.session);

            this.container.style.display = 'block';
            this.renderer.setAnimationLoop(this.render.bind(this));
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    stop() {
        if (this.session) {
            this.session.end().catch(e => { }); // Ignore if already ended
        }
        this.container.style.display = 'none';
        this.renderer.setAnimationLoop(null);
        this.reset();
    }

    render(timestamp, frame) {
        if (frame) {
            const referenceSpace = this.renderer.xr.getReferenceSpace();
            const session = this.renderer.xr.getSession();

            if (!this.hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((viewerSpace) => {
                    session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                        this.hitTestSource = source;
                    });
                });
                session.addEventListener('end', () => {
                    this.hitTestSourceRequested = false;
                    this.hitTestSource = null;
                });
                this.hitTestSourceRequested = true;
            }

            if (this.hitTestSource) {
                const hitTestResults = frame.getHitTestResults(this.hitTestSource);
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(referenceSpace);

                    this.reticle.visible = true;
                    this.reticle.matrix.fromArray(pose.transform.matrix);
                    const instr = document.getElementById('ar-instructions');
                    if (instr) instr.style.opacity = '0';
                } else {
                    this.reticle.visible = false;
                    const instr = document.getElementById('ar-instructions');
                    if (instr) {
                        instr.style.opacity = '1';
                        // Keep text consistent or slightly change to indicate active searching
                        instr.innerHTML = 'Scanning surfaces...<br>Wait for the blue ring to appear.';
                    }
                }
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
}
