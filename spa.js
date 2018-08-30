// simple homemade promise class :D
class Promise {
  constructor(resolve, reject) {
    this.resolved = null;
    this.handleResolve = resolve;
    this.rejected = null;
    this.handleReject = reject;
  }

  then(fn) {
    this.handleResolve = fn;
    if (this.resolved) this.handleResolve(...this.resolved);
  }

  catch(fn) {
    this.handleReject = fn;
    if (this.rejected) this.handleReject(...this.rejected);
  }

  resolve(...args) {
    if (this.handleResolve) this.handleResolve(...args);
    else this.resolved = [...args];
  }

  reject(...args) {
    if (this.handleReject) this.handleReject(...args);
    else this.rejected = [...args];
  }
}

let controller = { };

const loadFile = file => {
  const p = new Promise();
  const xhr = new XMLHttpRequest();
  xhr.open("GET", file);
  xhr.onload = () => p.resolve(xhr.responseText);
  xhr.onerror = () => p.reject(xhr.statusText);
  xhr.send();
  return p;
}

const loadPage = hash => {
  const p = new Promise();
  const { page, file } = getFilenameFromHash(hash);
  loadFile(file).then(contents => {
    p.resolve(page, contents);
  });
  return p;
}

const writeContents = (hash, contents) => {
  const hotspots = document.querySelectorAll('[hotspot]');
  let destination;
  let blank;
  for (let i = 0; i < hotspots.length; i++) {
    const spot = hotspots[i];
    const hashes = spot.getAttribute('hotspot');
    if (!hashes) blank = spot;
    const hashArray = hashes.split(' ');
    if (hashArray.includes(hash)) {
      destination = spot;
      break;
    }
  }
  // if we didn't find the hotspot for this hash, use the default one
  if (!destination) destination = blank;
  // if we STILL don't have a destination, we have nowhere to put content
  if (!destination) {
    console.error('NO DESTINATION FOR HASH', hash);
    return;
  }
  const contentspot = destination.querySelector('[content]') || destination;
  loadContents(contentspot, contents).then(() => {
    const last = document.querySelector('[hotspot]:not([hidden])');
    last && last.setAttribute('hidden', '');
    destination.removeAttribute('hidden');
  })
}

const loadContents = (element, contents) => {
  const p = new Promise();
  const { css, html, js } = parseContents(contents);
  let lastCss = document.head.querySelector('[temporary]');
  if (lastCss) document.head.removeChild(lastCss);
  document.head.innerHTML += css;
  element.innerHTML = html;

  // wrap this js in it's own scope
  let me = eval('(() => {' + js + '})()');
  processChildren(element, me).then(() => p.resolve());
  return p;
}

const processChildren = (element, ctrl) => {
  let p = new Promise();
  var me = ctrl;

  const children = element.children;
  let waiting = children.length;
  const proceed = (child, scope) => {
    for (let a = 0; a < child.attributes.length; a++) {
      let attr = child.attributes[a];
      if (attr.name.startsWith('on')) {
        let eventName = attr.name;
        let action = attr.value;
        child[eventName] = (...args) => {
          eval(action);
        };
      }
    }
    processChildren(child, scope).then(() => {
      waiting--;
      if (waiting == 0) {
        p.resolve();
      }
    });
  }
  if (waiting == 0) p.resolve();

  for (let c = 0; c < children.length; c++){
    let child = children[c];
    if(child.tagName === 'TEMPLATE') {
      const innerHtml = child.innerHTML;
      loadPage(child.getAttribute('type')).then((type, contents) => {
        let { css, html, js } = parseContents(contents);
        for (let a = 0; a < child.attributes.length; a++) {
          let attr = child.attributes[a];
          var patt = new RegExp('{{' + attr.name + '}}', 'gi');
          html = html.replace(patt, attr.value);
        }
        if (css) document.head.innerHTML += css;
        child.outerHTML = html
        child = children[c];
        child.innerHTML += innerHtml;
        if (js) {
          const parent = me;
          me = eval('(() => {' + js + '})()');
          me.parent = parent;
        }
        proceed(child, me);
      });
    } else {
      proceed(child, me);
    }
  }
  return p;
}

const process = (element) => {

}

// warning - does not work with nested tags of the same type!
const findTag = (contents, tag, options) => {
  options = options || {};
  const open = '<' + tag + (!options.selfClosing ? '>' : '');
  let start = contents.indexOf(open);
  let end;
  const close = options.selfClosing ? '/>' : '</' + tag + '>';
  const closeLength = close.length;
  if (start > -1) {
    end = contents.substr(start).indexOf(close);
  }
  if (start > -1 && end > -1) {
    let result = contents.substr(start, end + closeLength);
    if (options.innerHTML) {
      result = result.substr(open.length, result.length - (open.length + closeLength))
    }
    return result;
  }
  return '';
}

const setAttribute = (contents, name, value) => {
  let attributeText;
  if (value) {
    attributeText = ' ' + name + '="' + value + '" ';
  } else {
    attributeText = ' ' + name + ' ';
  }
  // handle self-closing tags
  if (contents.endsWith('/>')) {
    return contents.substr(0, contents.length - 2) + attributeText + '/>';
  }
  var index = contents.indexOf('>');
  return contents.substr(0, index) + attributeText + contents.substr(index);
}

const getAttribute = (contents, name) => {
  var attr = contents.indexOf(name + '="');
  if (attr < 0) {
    attr = contents.indexOf(name);
    if (attr > -1) return true;
    return '';
  };
  var valText = contents.substr(attr).indexOf('"');
  return contents.substr(attr, valText);
}

const parseContents = contents => {
  let css = findTag(contents, 'style');
  if (!css) css = findTag(contents, 'link', { selfClosing: true });
  if (css) css = setAttribute(css, 'temporary', '');

  let html = findTag(contents, 'html', { innerHTML: true });
  let js = findTag(contents, 'script', { innerHTML: true });
  if (!js) {
    js = findTag(contents, 'script', { selfClosing: true });
    // this isn't supported... yet
  }
  console.log(css, '\n\n', html, '\n\n', js);
  html = html || contents;
  return { css, html, js };
}

const getFilenameFromHash = hash => {
  const path = window.location.pathname;
  if (!hash || hash == '/') {
    hash = document.body.getAttribute('start') || 'index';
  }
  return { page: hash, file: path + hash + '.html' };
}

window.addEventListener('hashchange', e => {
  loadPage(window.location.hash.substr(1)).then(writeContents);
}, false);

document.addEventListener('DOMContentLoaded', e => {
  document.head.innerHTML += style;
  const hotspots = document.querySelectorAll('[hotspot]');
  let destination;
  for (let i = 0; i < hotspots.length; i++) {
    const spot = hotspots[i];
    spot.setAttribute('hidden', '');
  }
  loadPage(window.location.hash.substr(1)).then(writeContents);
}, false);

const style = `
    <style>
      [hotspot][hidden] {
        display: none;
      }
    </style>
`;
