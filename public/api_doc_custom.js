(function () {
  window.addEventListener("load", function () {
      setTimeout(function () {
          // Section 01 - Set url link
          const logo = document.getElementsByClassName('link');
          logo[0].href = "https://cashstory.com/en/";
          logo[0].target = "_blank";

          // Section 02 - Set logo
          // p = document.createElement("p")
          // p.appendChild(document.createTextNode("Documentation"))
          // logo[0].appendChild(p)
          logo[0].children[0].alt = "CashStory";
          logo[0].children[0].src = `${location.origin}/public/cashstory_all_white.png`;

          // Section 03 - Set 32x32 favicon
          // const linkIcon32 = document.createElement('link');
          const linkIcon32 = document.querySelectorAll('[sizes="32x32"]')[0];
          linkIcon32.type = 'image/png';
          // linkIcon32.rel = 'icon';
          linkIcon32.href = `${location.origin}/public/favicon.ico`;
          // linkIcon32.sizes = '32x32';
          // document.getElementsByTagName('head')[0].appendChild(linkIcon32);

          // Section 03 - Set 16x16 favicon
          const linkIcon16 = document.querySelectorAll('[sizes="16x16"]')[0];
          // const linkIcon16 = document.createElement('link');
          linkIcon16.type = 'image/png';
          // linkIcon16.rel = 'icon';
          linkIcon16.href = `${location.origin}/public/favicon.ico`;
          // linkIcon16.sizes = '16x16';
          // document.getElementsByTagName('head')[0].appendChild(linkIcon16);

      });
  });
})();
