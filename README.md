# hotspot
A simple single page application js framework


## Easy to Setup

Simply add `spa.js` to your `index.html` file and hotspot will automatically convert your files into a single page app!

### No routes to configure

Instead of having to set up a routing table, simply link to the files you want to use by using hash links.

``` <a href="#/path">this will load path.html</a> ```

The file will be processed and then loaded into the element marked with the `content` attribute.

### Ok, there are routes, KIND of

If you have a special 'route' that should be loaded into a spot OTHER than the main 'content' element, simply create an element with the `hotspot` attribute. The value should be a list of the routes or paths that should be loaded into this element, seperated by spaces.

``` <div hotspot="/one /two"></div> ```

### Using templates

Every other file in your application should adhere to the following format:

```
    <link rel="stylesheet" href="your-style-sheet.css"/>
    <html>
        <!-- all of your html -->
    </html>
    <script>
        // private logic
        
        // return a controller
        return {
            ...
        }
    </script>
```

Optionally, you can use `<style> ... </style>` at the top of the file instead of `<link ... />`

In your html, you can write standard html just like you would anywhere else.

### Bindings

Static, one-way, and two-way bindings are supported.

#### Static bindings

Is this the right name? I have no idea, but who cares. If you want to pass some argument into another template, you can invoke like so:

``` <template type="filename" arg1="abc" arg2="123"></template> ```

Inside filename.html, you can access those arguments by using curly braces:

``` <div>arg1 is {{arg1}}, arg2 is {{arg2}}</div> ```

The result will be rendered as:

``` <div>arg1 is abc, arg2 is 123</div> ```