(function () {
  var canvas = document.querySelector("#unity-canvas");
  var unityContainer = document.querySelector("#unity-container");
  var loadingBar = document.querySelector("#unity-loading-bar");
  var warningBanner = document.querySelector("#unity-warning");
  var progressBarFull = document.querySelector("#unity-progress-bar-full");
  var fullscreenButton = document.querySelector("#unity-fullscreen-button");

  function updateBannerVisibility() {
    warningBanner.classList.toggle(
      "unity-warning-visible",
      warningBanner.children.length > 0,
    );
  }

  function unityShowBanner(msg, type) {
    var div = document.createElement("div");
    div.innerHTML = msg;
    div.className = "unity-banner-message";

    if (type === "error") {
      div.classList.add("unity-banner-error");
    } else if (type === "warning") {
      div.classList.add("unity-banner-warning");
    }

    warningBanner.appendChild(div);
    updateBannerVisibility();

    if (type !== "error") {
      setTimeout(function () {
        if (div.parentNode === warningBanner) {
          warningBanner.removeChild(div);
          updateBannerVisibility();
        }
      }, 5000);
    }
  }

  var buildUrl = "Build";
  var loaderUrl = buildUrl + "/v1.loader.js";
  var config = {
    arguments: [],
    dataUrl: buildUrl + "/v1.data",
    frameworkUrl: buildUrl + "/v1.framework.js",
    codeUrl: buildUrl + "/v1.wasm",
    streamingAssetsUrl: "StreamingAssets",
    companyName: "DefaultCompany",
    productName: "My project (1)",
    productVersion: "0.1.0",
    showBanner: unityShowBanner,
  };

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    var meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content =
      "width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes";
    document.head.appendChild(meta);
    unityContainer.className = "unity-mobile";
    canvas.className = "unity-mobile";
  } else {
    canvas.classList.add("unity-desktop-canvas");
  }

  loadingBar.classList.add("unity-loading-visible");

  var script = document.createElement("script");
  script.src = loaderUrl;
  script.onload = function () {
    createUnityInstance(canvas, config, function (progress) {
      progressBarFull.style.width = 100 * progress + "%";
    })
      .then(function (unityInstance) {
        loadingBar.classList.remove("unity-loading-visible");
        fullscreenButton.onclick = function () {
          unityInstance.SetFullscreen(1);
        };
      })
      .catch(function (message) {
        alert(message);
      });
  };

  document.body.appendChild(script);
})();
