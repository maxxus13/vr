'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let maxR = 1;
let stereoCamera;

let texture;

let webCameraTexture;
let webCameraVideo;
let webCamera;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTextCoordBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, textCoords) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textCoords), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTextCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTextCoord);
   
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;

    this.iAttribTextCoord = -1;

    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.iModelViewMatrix = -1;

    this.iProjectionMatrix = -1;

    this.iTMU = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.orthographic(0, 1, 0, 1, -1, 1);
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0);

    let matAccum = m4.multiply(rotateToPointZero, modelView );

    let noRot = m4.multiply(rotateToPointZero, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    const stereoCamera = {
        eyeSeparation: parseFloat(document.getElementById("eyeSeparation").value),
        convergence: parseFloat(document.getElementById("convergence").value),
        aspectRatio: gl.canvas.width / gl.canvas.height,
        fov: parseFloat(document.getElementById("fov").value),
        near: parseFloat(document.getElementById("near").value),
        far: 50.0,
    };

    gl.uniform1i(shProgram.iTMU, 0);

    let projectionLeft = applyLeftFrustum(stereoCamera);
    let projectionRight = applyRightFrustum(stereoCamera);

    let translateToLeft = m4.translation(-0.03, 0, -20);
    let translateToRight = m4.translation(0.03, 0, -20);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, noRot);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);

    gl.bindTexture(gl.TEXTURE_2D, webCameraTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webCameraVideo);
    webCamera.Draw();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matAccumLeft = m4.multiply(translateToLeft, matAccum);
    let matAccumRight = m4.multiply(translateToRight, matAccum);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccumLeft);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projectionLeft);
    gl.colorMask(true, false, false, false);
    surface.Draw();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccumRight);
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projectionRight);
    gl.colorMask(false, true, true, false);
    surface.Draw();

    gl.colorMask(true, true, true, true);
}

function CreateSurfaceData() {
    let vertexList = [];
    let normalList = [];
	let textCoordList = [];
    let step = 0.03;
    let delta = 0.001;

    for (let u = -3.5 * Math.PI; u <= 3.5 * Math.PI; u += step) {
        for (let v = 0.005 * Math.PI; v < Math.PI / 2; v += step) {

            let v1 = equations(u, v);
            let v2 = equations(u, v + step);
            let v3 = equations(u + step, v);
            let v4 = equations(u + step, v + step);

            vertexList.push(v1.x, v1.y, v1.z);
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v3.x, v3.y, v3.z);
            
            vertexList.push(v2.x, v2.y, v2.z);
            vertexList.push(v4.x, v4.y, v4.z);
            vertexList.push(v3.x, v3.y, v3.z);

            let n1 = CalculateNormal(u, v, delta);
            let n2 = CalculateNormal(u, v + step, delta);
            let n3 = CalculateNormal(u + step, v, delta);
            let n4 = CalculateNormal(u + step, v + step, delta)

            normalList.push(n1.x, n1.y, n1.z);
            normalList.push(n2.x, n2.y, n2.z);
            normalList.push(n3.x, n3.y, n3.z);
            
            normalList.push(n2.x, n2.y, n2.z);
            normalList.push(n4.x, n4.y, n4.z);
            normalList.push(n3.x, n3.y, n3.z);
			
			let t1 = CalculateTextCoord(u, v);
            let t2 = CalculateTextCoord(u, v + step);
            let t3 = CalculateTextCoord(u + step, v);
            let t4 = CalculateTextCoord(u + step, v + step);

            textCoordList.push(t1.u, t1.v);
            textCoordList.push(t2.u, t2.v);
            textCoordList.push(t3.u, t3.v);
            
            textCoordList.push(t2.u, t2.v);
            textCoordList.push(t4.u, t4.v);
            textCoordList.push(t3.u, t3.v);
        }
    }

    return { vertices: vertexList, normal: normalList, textCoords: textCoordList };
}

function CalculateNormal(u, v, delta) {
    let currentPoint = equations(u, v);
    let pointR = equations(u + delta, v);
    let pointTheta = equations(u, v + delta);

    let dg_du = {
        x: (pointR.x - currentPoint.x) / delta,
        y: (pointR.y - currentPoint.y) / delta,
        z: (pointR.z - currentPoint.z) / delta
    };

    let dg_dv = {
        x: (pointTheta.x - currentPoint.x) / delta,
        y: (pointTheta.y - currentPoint.y) / delta,
        z: (pointTheta.z - currentPoint.z) / delta
    };

    let normal = cross(dg_du, dg_dv);

    normalize(normal);

    return normal;
}

function cross(a, b) {
    let x = a.y * b.z - b.y * a.z;
    let y = a.z * b.x - b.z * a.x;
    let z = a.x * b.y - b.x * a.y;
    return { x: x, y: y, z: z }
}

function normalize(a) {
    var b = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    a.x /= b;
    a.y /= b;
    a.z /= b;
}


function CalculateTextCoord(u, v) {

    u = (u - 0.25)/(maxR - 0.25);
    v = v / 2*Math.PI;

    return {u, v};
}

function equations(u, v) {
    let C = 2;
    let fiU = -u / (Math.sqrt(C + 1)) + Math.atan(Math.sqrt(C + 1) * Math.tan(u));
    let aUV = 2 / (C + 1 - C * Math.pow(Math.sin(v), 2) * Math.pow(Math.cos(u), 2));
    let rUV = (aUV / Math.sqrt(C)) * Math.sqrt((C + 1) * (1 + C * Math.pow(Math.sin(u), 2))) * Math.sin(v);

    let x = rUV * Math.cos(fiU);
    let y = rUV * Math.sin(fiU);
    let z = (Math.log(Math.tan(v / 2)) + aUV * (C + 1) * Math.cos(v)) / Math.sqrt(C);

    return { x: x, y: y, z: z };
}

function applyLeftFrustum (stereoCamera) {
    let { eyeSeparation, convergence, aspectRatio, fov, near, far } = stereoCamera;
    let top = near * Math.tan(fov / 2);
    let bottom = -top;
  
    let a = aspectRatio * Math.tan(fov / 2) * convergence;
    let b = a - eyeSeparation / 2;
    let c = a + eyeSeparation / 2;
  
    let left = (-b * near) / convergence;
    let right = (c * near) / convergence;
  
    return m4.orthographic(left, right, bottom, top, near, far);
}

  function applyRightFrustum (stereoCamera) {
    let { eyeSeparation, convergence, aspectRatio, fov, near, far } = stereoCamera;
    let top = near * Math.tan(fov / 2);
    let bottom = -top;
  
    let a = aspectRatio * Math.tan(fov / 2) * convergence;
    let b = a - eyeSeparation / 2;
    let c = a + eyeSeparation / 2;
  
    let left = (-c * near) / convergence;
    let right = (b * near) / convergence;

    return m4.orthographic(left, right, bottom, top, near, far);
}


// Function to update the surface with the new max value of parameter r
function updateSurface() {
    maxR = parseFloat(document.getElementById("paramR").value);

    let data = CreateSurfaceData(maxR);
    surface.BufferData(data.vertices, data.textCoords);

    document.getElementById("currentMaxR").textContent = maxR.toFixed(2);

    draw();
}

function updateWebCamera() {
    draw();
    window.requestAnimationFrame(updateWebCamera);
}

function LoadTexture() {

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var image = new Image();
    image.crossOrigin = "anonymous";
    image.src = "https://i.ibb.co/DpJ0WzF/texture6.png";
    image.addEventListener('load', () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        draw();
    }
    );
}

function LoadWebCameraTexture() {

    webCameraTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webCameraTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function getWebCamera() {
    return new Promise((resolve) =>
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((s) => resolve(s))
    );
  };

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iAttribTextCoord           = gl.getAttribLocation(prog, "textCoord");
    shProgram.iTMU                       = gl.getUniformLocation(prog, "tmu");

    surface = new Model('Surface');
    let data = CreateSurfaceData();
    surface.BufferData(data.vertices, data.textCoords);

    webCamera = new Model('WebCamera');
    webCamera.BufferData(
        [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0,],
        [1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]
    );

    LoadTexture();
    LoadWebCameraTexture();

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }

        webCameraVideo = document.createElement("video");
        webCameraVideo.setAttribute("autoplay", true);
        window.vid = webCameraVideo;

        getWebCamera().then((stream) => (webCameraVideo.srcObject = stream));

    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>" + e;
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    updateSurface();
    updateWebCamera();
}