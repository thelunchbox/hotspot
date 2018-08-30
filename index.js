var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

const mimeType = {
    bmp: 'image/bmp',
    css: 'text/css',
    csv: 'text/csv',
    gif: 'image/gif',
    htm: 'text/html',
    html: 'text/html',
    ico: 'image/x-icon',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    js: 'application/javascript',
    json: 'application/json',
    otf: 'font/otf',
    png: 'image/png',
    pdf: 'application/pdf',
    svg: 'image/svg+xml',
    ttf: 'font/ttf',
    txt: 'text/plain',
    xml: 'application/xml',
    zip: 'application/zip'
};

http.createServer(function (req, res) {
  try {
    var q = url.parse(req.url, true);
    var filePath = "." + q.pathname.replace(/%20/g, ' ');
    console.log(filePath);
    if (fs.existsSync(filePath)){
      if (fs.lstatSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, filePath, 'index.html');
      }
    } else {
      console.error('File not found', filePath);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end('404 Not Found');
    }
    console.log('Looking for file', filePath);
    fs.readFile(filePath, function (err, data) {
        var split = filePath.split('.');
        var ext = split[split.length - 1];

        console.log('Sending file to client', filePath);
        res.writeHead(200, { 'Content-Type': mimeType[ext.toLowerCase()] });
        res.write(data);
        return res.end();
    });
  } catch (ex) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      return res.end('500 Internal Server Error<br/>' + ex);
  }
}).listen(8080);

console.log('Webserver started on port 8080');
