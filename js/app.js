document.addEventListener('DOMContentLoaded', () => {
    const landingView = document.getElementById('landing-view');
    const arView = document.getElementById('ar-view');
    const btnBack = document.getElementById('btn-back');
    const unsupportedAlert = document.getElementById('xr-unsupported-alert');

    let arRuler = null;

    document.getElementById('btn-ar-ruler').addEventListener('click', async () => {
        unsupportedAlert.classList.add('d-none');

        if (!navigator.xr) {
            unsupportedAlert.classList.remove('d-none');
            return;
        }

        try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!supported) {
                unsupportedAlert.classList.remove('d-none');
                return;
            }
        } catch (e) {
            unsupportedAlert.classList.remove('d-none');
            return;
        }

        // Hide landing, show AR
        landingView.classList.add('d-none');
        btnBack.classList.remove('d-none');
        document.getElementById('btn-clear').classList.remove('d-none');
        arView.classList.remove('d-none');

        if (!arRuler) {
            arRuler = new ARRuler();
        }

        const started = await arRuler.start();
        if (!started) {
            landingView.classList.remove('d-none');
            btnBack.classList.add('d-none');
            document.getElementById('btn-clear').classList.add('d-none');
            arView.classList.add('d-none');
            unsupportedAlert.classList.remove('d-none');
            unsupportedAlert.textContent = "Failed to start AR Session.";
        }
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        if (arRuler) {
            arRuler.clearLines();
        }
    });

    btnBack.addEventListener('click', () => {
        // Stop AR if running
        if (arRuler) {
            arRuler.stop();
        }

        landingView.classList.remove('d-none');
        btnBack.classList.add('d-none');
        document.getElementById('btn-clear').classList.add('d-none');
        arView.classList.add('d-none');
        unsupportedAlert.classList.add('d-none');
    });
});
