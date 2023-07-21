let controller = {};

const selfClosing = 'selfClosing';
const innerHTML = 'innerHTML';

const loadFile = file => {
  return fetch(file).then(response => response.text())
}

const loadPage = async hash => {
  const { page, file } = getFilenameFromHash(hash);
  const contents = await loadFile(file);
  return { page, contents };
}

const writeContents = async (hash, contents) => {
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
  await loadContents(contentspot, contents);
  const last = document.querySelector('[hotspot]:not([hidden])');
  last && last.setAttribute('hidden', '');
  destination.removeAttribute('hidden');
}

const loadContents = async (element, contents) => {
  const { css, html, js } = parseContents(contents);
  let lastCss = document.head.querySelector('[temporary]');
  if (lastCss) document.head.removeChild(lastCss);
  document.head.innerHTML += css;
  element.innerHTML = html;

  // wrap this js in it's own scope
  let me = eval('(() => {' + js + '})()');
  me._bindings = [];
  await processChildren(element, me);
}

const processChildren = async (element, ctrl) => {
  var me = ctrl;

  const children = element.children;
  let waiting = children.length;
  const proceed = async (child, scope) => {
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
    await processChildren(child, scope);
    waiting--;
    if (waiting == 0) {
      return;
    }
  }
  if (waiting == 0) return;

  for (let c = 0; c < children.length; c++) {
    let child = children[c];
    if (child.tagName === 'TEMPLATE') {
      const childInnerHtml = child.innerHTML;
      const { contents } = await loadPage(child.getAttribute('type'));
      let { css, html, js } = parseContents(contents);

      if (js) {
        const parent = me;
        me = eval('(() => {' + js + '})()');
        me.parent = parent;
        me.__bindings = [];
      }

      for (let a = 0; a < child.attributes.length; a++) {
        let attr = child.attributes[a];
        var patt = new RegExp('{{' + attr.name + '}}', 'i'); //gi for global
        var value = attr.value;
        if (value.startsWith('{') && value.endsWith('}')) {
          const prop = value.substr(1, value.length - 2);
          const actualValue = eval(prop);
          const propPath = prop.split('.');
          const base = propPath.slice(0, propPath.length - 1).join('.');
          const baseObject = eval(base);
          const propName = propPath[propPath.length - 1];
          const internalProp = '_' + propName;
          baseObject[internalProp] = actualValue;
          Object.defineProperty(baseObject, propName, {
            get: function () {
              return baseObject[internalProp];
            },
            set: function (payload) {
              baseObject[internalProp] = payload;
              // update the DOM
            }
          });
        }
        // bad - can't just use replace bc then I can't track binding locations
        // html = html.replace(patt, value);

        // good - go through each instance of 'patt' and replace while figuring out where I was
        while ((match = patt.exec(html)) != null) {
          const location = match.index;
          html = html.replace(patt, value);
          // find out the selector path to this as well as if it's an attr or innerHTML
        }

      }
      if (css) document.head.innerHTML += css;
      child.outerHTML = html
      child = children[c];
      child.innerHTML += childInnerHtml;
      await proceed(child, me);
    } else {
      await proceed(child, me);
    }
  }
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
  if (!css) css = findTag(contents, 'link', { selfClosing });
  if (css) css = setAttribute(css, 'temporary', '');

  const html = findTag(contents, 'html', { innerHTML }) || contents;
  let js = findTag(contents, 'script', { innerHTML });
  if (!js) {
    js = findTag(contents, 'script', { selfClosing }) || 'return {};';
  }
  console.log(css, '\n\n', html, '\n\n', js);
  return { css, html, js };
}

const getFilenameFromHash = hash => {
  let path = window.location.pathname;
  if (!path.endsWith('/')) path += '/';
  if (!hash || hash == '/') {
    hash = document.body.getAttribute('start') || 'index';
  }
  return { page: hash, file: path + hash + '.html' };
}

window.addEventListener('hashchange', async e => {
  const { page, contents } = await loadPage(window.location.hash.substr(1));
  writeContents(page, contents)
}, false);

document.addEventListener('DOMContentLoaded', async e => {
  document.head.innerHTML += style;
  const hotspots = document.querySelectorAll('[hotspot]');
  for (let i = 0; i < hotspots.length; i++) {
    const spot = hotspots[i];
    spot.setAttribute('hidden', '');
  }
  const { page, contents } = await loadPage(window.location.hash.substr(1));
  writeContents(page, contents)
}, false);

const style = `
    <style>
      [hotspot][hidden] {
        display: none;
      }
    </style>
`;
