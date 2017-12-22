
import * as LZ77 from 'lz77';
import * as Viewer from 'viewer';
import * as BMD from 'bmd';
import * as GX from 'gx';
import { fetch } from 'util';

const BLACK_VERT_SHADER_SOURCE = `
precision mediump float;
uniform mat4 u_modelView;
uniform mat4 u_projection;
attribute vec3 a_position;

void main() {
    gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);
}
`;

const BLACK_FRAG_SHADER_SOURCE = `
precision mediump float;

void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

class BlackProgram extends Viewer.Program {
    positionLocation:number;

    vert = BLACK_VERT_SHADER_SOURCE;
    frag = BLACK_FRAG_SHADER_SOURCE;

    getAttribLocation(vtxAttrib:GX.VertexAttribute) {
        switch (vtxAttrib) {
        case GX.VertexAttribute.POS:
            return this.positionLocation;
        }
        return null;
    }

    bind(gl:WebGLRenderingContext, prog:WebGLProgram) {
        super.bind(gl, prog);

        this.positionLocation = gl.getAttribLocation(prog, "a_position");
    }
}

function translateCompType(gl:WebGLRenderingContext, compType:GX.CompType):number {
    switch (compType) {
    case GX.CompType.F32:
        return gl.FLOAT;
    case GX.CompType.S8:
        return gl.BYTE;
    case GX.CompType.S16:
        return gl.SHORT;
    case GX.CompType.U16:
        return gl.UNSIGNED_SHORT;
    case GX.CompType.U8:
        return gl.UNSIGNED_BYTE;
    case GX.CompType.RGBA8: // XXX: Is this right?
        return gl.UNSIGNED_BYTE;
    default:
        throw new Error(`Unknown CompType ${compType}`);
    }
}

function translatePrimType(gl:WebGLRenderingContext, primType:GX.PrimitiveType):number {
    switch (primType) {
    case GX.PrimitiveType.TRIANGLESTRIP:
        return gl.TRIANGLE_STRIP;
    case GX.PrimitiveType.TRIANGLEFAN:
        return gl.TRIANGLE_FAN;
    default:
        throw new Error(`Unknown PrimType ${primType}`);
    }
}

class Command_Shape {
    bmd:BMD.BMD;
    shape:BMD.Shape;
    buffer:WebGLBuffer;
    constructor(gl:WebGLRenderingContext, bmd:BMD.BMD, shape:BMD.Shape) {
        this.bmd = bmd;
        this.shape = shape;
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.shape.packedData, gl.STATIC_DRAW);
        console.log(new Uint8Array(this.shape.packedData));
    }
    exec(state:Viewer.RenderState) {
        const gl = state.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

        const program:BlackProgram = (<BlackProgram> state.currentProgram);

        // Set up vertex attributes.
        for (const attrib of this.shape.packedVertexAttributes) {
            const attribLocation = program.getAttribLocation(attrib.vtxAttrib);
            if (attribLocation === null) continue; // XXX(jstpierre)
            gl.enableVertexAttribArray(attribLocation);

            const vertexArray = this.bmd.vtx1.vertexArrays.get(attrib.vtxAttrib);
            gl.vertexAttribPointer(
                attribLocation,
                vertexArray.compSize,
                translateCompType(gl, vertexArray.compType),
                false,
                this.shape.packedVertexSize,
                attrib.offset
            );
        }

        // Do draw calls.
        for (const drawCall of this.shape.drawCalls) {
            gl.drawArrays(translatePrimType(gl, drawCall.primType), drawCall.first, drawCall.vertexCount);
        }

        for (const attrib of this.shape.packedVertexAttributes) {
            const attribLocation = program.getAttribLocation(attrib.vtxAttrib);
            if (attribLocation === null) continue; // XXX(jstpierre)
            gl.disableVertexAttribArray(attribLocation);
        }
    }
}

type Command = Command_Shape;

export class Scene implements Viewer.Scene {
    gl:WebGLRenderingContext;
    cameraController = Viewer.FPSCameraController;
    textures:HTMLCanvasElement[];
    program_Black:BlackProgram;
    bmd:BMD.BMD;
    commands:Command[];

    constructor(gl, bmd) {
        this.gl = gl;
        this.program_Black = new BlackProgram();
        this.bmd = bmd;
        this.translateModel(this.bmd);
    }
    translateModel(bmd:BMD.BMD) {
        this.commands = [];
        // Iterate through scene graph.
        this.translateSceneGraph(bmd.inf1.sceneGraph);
    }
    translateSceneGraph(node:BMD.HierarchyNode) {
        switch (node.type) {
        case BMD.HierarchyType.Open:
            for (const child of node.children)
                this.translateSceneGraph(child);
            break;
        case BMD.HierarchyType.Shape:
            const shape = this.bmd.shp1.shapes[node.shapeIdx];
            this.commands.push(new Command_Shape(this.gl, this.bmd, shape));
            break;
        case BMD.HierarchyType.Joint:
            // XXX: Implement joints...
            break;
        case BMD.HierarchyType.Material:
            // XXX: Implement materials...
            break;
        }
    }
    render(state:Viewer.RenderState) {
        state.useProgram(this.program_Black);
        for (const command of this.commands)
            command.exec(state);
    }
}

export class SceneDesc implements Viewer.SceneDesc {
    name:string;
    path:string;

    constructor(name:string, path:string) {
        this.name = name;
        this.path = path;
    }

    createScene(gl:WebGLRenderingContext):PromiseLike<Scene> {
        return fetch(this.path).then((result:ArrayBuffer) => {
            let bmd = BMD.parse(result);
            return new Scene(gl, bmd);
        });
    }
}
