
import * as Viewer from '../viewer';
import * as TEX from './tex';
import * as RFL from './rfl';
import * as RF3D from './rf3d';
import { GfxDevice, GfxHostAccessPass } from '../gfx/platform/GfxPlatform';
import Progressable from '../Progressable';
import { fetchData } from '../fetch';
import { assert, makeTextDecoder } from '../util';
import { RedfactionRenderer, SceneRenderer, ClutterRenderer } from './render';
import { BasicRendererHelper } from '../oot3d/render';
import * as VPP from './vpp'
import * as TBL from './tbl'

//////////
import ArrayBufferSlice from "../ArrayBufferSlice";
import { DataStream } from "./DataStream"
import { TEXTextureBitmap } from './tex';
////////////

const pathBase = `rf`;

const utf8Decoder = makeTextDecoder('utf-8');

class SceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, public filename: string) {
    }

    private addTexture(device: GfxDevice, renderer: RedfactionRenderer, findTex: string, vpp: VPP.VPP): void {
        const texStr = findTex.toLowerCase().replace(/\.(tga|vbm)$/, '')
        let vppSearch: VPP.VPPFile[]

        //attempt to find vbm of same name first (red faction seems to override tga with vbm if present)
        vppSearch = vpp.files.filter((searchFile) => searchFile.name === `${texStr}.vbm`)
        if (vppSearch.length > 0) {
            this._addTexture(device, renderer, vppSearch, texStr, texStr)
            return
        }

        //try tga next
        //todo: is there a non-hacky way of doing mip levels?
        //the stock game files only goes 5 levels, unsure if custom tgas can be mipped
        //vbms can be mipped but mipped vbms are still a single file
        vppSearch = vpp.files.filter((searchFile) => searchFile.name.replace(/-mip[0-9]\./, '.') === `${texStr}.tga`)
        if (vppSearch.length > 0) {
            this._addTexture(device, renderer, vppSearch, texStr, texStr)
            return
        }

        //else default missing texture
        vppSearch = vpp.files.filter((searchFile) => searchFile.name === `rck_default.tga`)
        if (vppSearch.length > 0) {
            this._addTexture(device, renderer, vppSearch, texStr, 'rck_default')
            console.warn(`replaced missing texture "${findTex.toLowerCase()}" with rck_default.tga`)
            return
        }

        throw `💩: could not find texture ${findTex.toLowerCase()} and could not find rck_default.tga`
    }

    private _addTexture(device: GfxDevice, renderer: RedfactionRenderer, texFiles: VPP.VPPFile[], texName: string, fakeTexName: string): void {
        //todo: don't re-parse if texture already added
        let tex: TEXTextureBitmap;
        let levels: TEXTextureBitmap[] = []
        let texDepth = 1
        if (texFiles[0].name.endsWith('.vbm')) {
            levels = TEX.parseVBM(texFiles[0].data)
            texDepth = levels[0].depth
        } else if (texFiles[0].name.endsWith('.tga')) {
            let baseLevel = texFiles.find((searchFile) => searchFile.name === `${fakeTexName}.tga`)
            tex = TEX.parseTGA(baseLevel.data)
            levels.push(tex)
            let mips = texFiles.filter((searchFile) => searchFile.name !== `${fakeTexName}.tga`)
            for (let i = 1; i < mips.length + 1; i++) {
                let mip = mips.find((searchFile) => searchFile.name.endsWith(`-mip${i}.tga`))
                if (mip) {
                    let mipTex: TEXTextureBitmap
                    mipTex = TEX.parseTGA(mip.data)
                    levels.push(mipTex)
                }
            }
        }
        renderer.textureHolder.addTextures(device, [{
            name: texName,
            width: levels[0].width,
            height: levels[0].height,
            animated: false,
            levels,
            alpha: levels[0].actuallyUsesAlpha,
            depth: texDepth
        }])
    }

    private _fetchVPP(id: string): Progressable<VPP.VPP> {
        return fetchData(`rf/${id}.vpp`).then((buffer) => {
            const vpp = VPP.parse(buffer);
            return vpp;
        })
    }

    public createScene(device: GfxDevice, abortSignal: AbortSignal): Progressable<Viewer.SceneGfx> {
        return Progressable.all([this._fetchVPP(this.filename), this._fetchVPP('maps_en'), this._fetchVPP('maps1'), this._fetchVPP('maps2'), this._fetchVPP('maps3'), this._fetchVPP('maps4'), this._fetchVPP('tables'), this._fetchVPP('meshes')]).then(([baseVPP, maps_en, maps1, maps2, maps3, maps4, tables, meshes]) => {
        //return Progressable.all([this._fetchVPP(this.filename), this._fetchVPP('maps69')]).then(([levels1, maps1]) => {
        //return Progressable.all([fetchData(`rf/levels/${this.id}.rfl`), fetchData('rf/tables.vpp')]).then(async ([rflFileSlice, tablesVPPRaw]) => {
            const renderer = new RedfactionRenderer();

            const vppCombined: VPP.VPP = <VPP.VPP>{};
            vppCombined.files = baseVPP.files;
            vppCombined.files = vppCombined.files.concat(maps_en.files)
            vppCombined.files = vppCombined.files.concat(maps1.files)
            vppCombined.files = vppCombined.files.concat(maps2.files)
            vppCombined.files = vppCombined.files.concat(maps3.files)
            vppCombined.files = vppCombined.files.concat(maps4.files)
            vppCombined.files = vppCombined.files.concat(tables.files)
            vppCombined.files = vppCombined.files.concat(meshes.files)

            let clutterTbl = vppCombined.files.find((checkFile) => checkFile.name === `clutter.tbl`.toLowerCase())
            if (!clutterTbl) throw `💩: could not find clutter.tbl`            
            const clutterTxt = utf8Decoder.decode(clutterTbl.data.copyToBuffer(0, clutterTbl.size))
            let clutter = TBL.parseClutter(clutterTxt)

            let itemsTbl = vppCombined.files.find((checkFile) => checkFile.name === `items.tbl`.toLowerCase())
            if (!itemsTbl) throw `💩: could not find items.tbl`            
            const itemsTxt = utf8Decoder.decode(itemsTbl.data.copyToBuffer(0, itemsTbl.size))
            let items = TBL.parseItems(itemsTxt)

            let entityTbl = vppCombined.files.find((checkFile) => checkFile.name === `entity.tbl`.toLowerCase())
            if (!entityTbl) throw `💩: could not find entity.tbl`            
            const entityTxt = utf8Decoder.decode(entityTbl.data.copyToBuffer(0, entityTbl.size))
            let entities = TBL.parseEntities(entityTxt)

            let rflFile = vppCombined.files.find((checkFile) => checkFile.name === `${this.id}.rfl`.toLowerCase())
            if (!rflFile) throw `💩: could not find ${this.id}.rfl`
            const rflData = RFL.parse(rflFile.data)

            console.log(rflData)

            //TODO: fix for levels that dont use 128x128? is that even valid?
            const lightmapSects: RFL.RF1Lightmaps[] = rflData.filter((sect) => sect.type === RFL.RFLSections.LIGHTMAPS) as RFL.RF1Lightmaps[]
            for (let lmSect in lightmapSects) {
                //let fadhjsjklkgg : TEX.TEXTextureBitmap = <TEX.TEXTextureBitmap>{};
                //fadhjsjklkgg.height = 128;
                //fadhjsjklkgg.width = 128;
                //fadhjsjklkgg.actuallyUsesAlpha = false;

                let lampy : TEX.TEXTextureBitmap = <TEX.TEXTextureBitmap>{ width: 128, height: 128};
                let tex_decomp_buff = new ArrayBuffer(128 * 128 * 4 * lightmapSects[lmSect].lightmaps.length);
                lampy.data = new ArrayBufferSlice(tex_decomp_buff)
                let tex_stream = new DataStream(lampy.data)
                lampy.actuallyUsesAlpha = false
                for (let lamp of lightmapSects[lmSect].lightmaps) {
                    let stream2 = new DataStream(lamp.bitmap)
                    for (let i = 0; i < lamp.bitmap.byteLength; i+=3) {
                        tex_stream.writeUint8(stream2.readUint8())
                        tex_stream.writeUint8(stream2.readUint8())
                        tex_stream.writeUint8(stream2.readUint8())
                        tex_stream.writeUint8(255)
                    }
                }
                //fadhjsjklkgg.data = lampy.data
                const name = `redfaction-lightmap-array-${lmSect}`
                renderer.textureHolder.addTextures(device, [{ name, width: 128, height: 128, animated: false, levels: [lampy], alpha: false, depth: lightmapSects[lmSect].lightmaps.length }])
            }//*/


            const staticGeoSects: RFL.RF1Rooms[] = rflData.filter((sect) => sect.type === RFL.RFLSections.STATIC_GEOMETRY) as RFL.RF1Rooms[]
            for (let roomSect of staticGeoSects)
                for (let texture of roomSect.textures)
                    this.addTexture(device, renderer, texture, vppCombined)

            const moverSects: RFL.RF1Movers[] = rflData.filter((sect) => sect.type === RFL.RFLSections.MOVERS) as RFL.RF1Movers[]
            for (let moverSect of moverSects)
                for (let mover of moverSect.movers)
                    for (let texture of mover.textures)
                        this.addTexture(device, renderer, texture, vppCombined)
            
            let clutterModelDatas: { [className: string] : RF3D.RF3DBaseInterface[] } = {}

            const clutterSects: RFL.RF1Clutters[] = rflData.filter((sect) => sect.type === RFL.RFLSections.CLUTTERS) as RFL.RF1Clutters[]
            for (let clutterSect of clutterSects) {
                for (let clutterEntry of clutterSect.clutters) {
                    const clutterName = clutterEntry.className.toLowerCase()
                    const clutterSkin = clutterEntry.skin.toLowerCase()
                    const clutterExists = clutter[clutterName] !== undefined
                    let materialOverrides: string[] = undefined
                    if (!clutterExists) {
                        console.warn(`could not find clutter ${clutterName} in clutter.tbl`)
                        continue
                    }
                    
                    //parse clutter model if not already parsed
                    if (clutterModelDatas[clutterName] === undefined) {
                        const modelFileName = clutter[clutterName].modelFile
                        let modelFile = vppCombined.files.find((checkFile) => {
                            if (checkFile.nameBase === modelFileName) {
                                //let checkFileExt = checkFile.name.match(/\.(v3d|v3m|v3c|vfx)$/) //TODO: UNDO WHEN VFX SUPPORTED
                                let checkFileExt = checkFile.name.match(/\.(v3d|v3m|v3c)$/)
                                if (checkFileExt && checkFileExt.length > 0)
                                    return true
                            } return false
                        })
                        if (!modelFile) {
                            console.warn(`could not find model file ${modelFileName} for clutter ${clutterName}`)
                            continue
                        }

                        clutterModelDatas[clutterName] = RF3D.parse(modelFile.data)

                        const clutterModelSections = clutterModelDatas[clutterName].filter((sect) => sect.type === RF3D.RF3DSections.SUBMESH) as RF3D.RF3DSubmesh[]
                        for (let submeshSect of clutterModelSections)
                            for (let material of submeshSect.materials)
                                this.addTexture(device, renderer, material.diffuseMapName, vppCombined)

                    }

                    if (clutterSkin !== '') {
                        if (clutter[clutterName].skins === undefined) {
                            console.warn(`could not find skin ${clutterSkin} for ${clutterName} in clutter.tbl`)
                        } else {
                            materialOverrides = clutter[clutterName].skins[clutterSkin].materials
                            for (let material of materialOverrides)
                                this.addTexture(device, renderer, material, vppCombined)
                        }
                    }

                    renderer.addClutterRenderer(device, new ClutterRenderer(device, renderer.textureHolder, clutterModelDatas[clutterName], clutterEntry, materialOverrides));
                }
            }//*/

            let itemModelDatas: { [className: string] : RF3D.RF3DBaseInterface[] } = {}

            const itemSects: RFL.RF1Items[] = rflData.filter((sect) => sect.type === RFL.RFLSections.ITEMS) as RFL.RF1Items[]
            for (let itemSect of itemSects) {
                for (let itemEntry of itemSect.items) {
                    const itemName = itemEntry.className.toLowerCase()
                    const itemExists = items[itemName] !== undefined
                    if (!itemExists) {
                        console.warn(`could not find item ${itemName} in items.tbl`)
                        continue
                    }
                    
                    //parse item model if not already parsed
                    if (itemModelDatas[itemName] === undefined) {
                        const modelFileName = items[itemName].modelFile
                        let modelFile = vppCombined.files.find((checkFile) => {
                            if (checkFile.nameBase === modelFileName) {
                                //let checkFileExt = checkFile.name.match(/\.(v3d|v3m|v3c|vfx)$/) //TODO: UNDO WHEN VFX SUPPORTED
                                let checkFileExt = checkFile.name.match(/\.(v3d|v3m|v3c)$/)
                                if (checkFileExt && checkFileExt.length > 0)
                                    return true
                            } return false
                        })
                        if (!modelFile) {
                            console.warn(`could not find model file ${modelFileName} for item ${itemName}`)
                            continue
                        }

                        itemModelDatas[itemName] = RF3D.parse(modelFile.data)

                        const itemModelSections = itemModelDatas[itemName].filter((sect) => sect.type === RF3D.RF3DSections.SUBMESH) as RF3D.RF3DSubmesh[]
                        for (let submeshSect of itemModelSections)
                            for (let material of submeshSect.materials)
                                this.addTexture(device, renderer, material.diffuseMapName, vppCombined)

                    }

                    renderer.addClutterRenderer(device, new ClutterRenderer(device, renderer.textureHolder, itemModelDatas[itemName], itemEntry, undefined));
                }
            }//*/

            let entityModelDatas: { [className: string] : RF3D.RF3DBaseInterface[] } = {}

            const entitySects: RFL.RF1Entities[] = rflData.filter((sect) => sect.type === RFL.RFLSections.ENTITIES) as RFL.RF1Entities[]
            for (let entitySect of entitySects) {
                for (let entityEntry of entitySect.entities) {
                    const entityName = entityEntry.className.toLowerCase()
                    const entityExists = entities[entityName] !== undefined
                    if (!entityExists) {
                        console.warn(`could not find entity ${entityName} in entity.tbl`)
                        continue
                    }
                    
                    //parse entity model if not already parsed
                    if (entityModelDatas[entityName] === undefined) {
                        const modelFileName = entities[entityName].modelFile
                        let modelFile = vppCombined.files.find((checkFile) => {
                            if (checkFile.nameBase === modelFileName) {
                                //let checkFileExt = checkFile.name.match(/\.(v3d|v3m|v3c|vfx)$/) //TODO: UNDO WHEN VFX SUPPORTED
                                let checkFileExt = checkFile.name.match(/\.(v3d|v3m|v3c)$/)
                                if (checkFileExt && checkFileExt.length > 0)
                                    return true
                            } return false
                        })
                        if (!modelFile) {
                            console.warn(`could not find model file ${modelFileName} for entity ${entityName}`)
                            continue
                        }

                        entityModelDatas[entityName] = RF3D.parse(modelFile.data)

                        const itemModelSections = entityModelDatas[entityName].filter((sect) => sect.type === RF3D.RF3DSections.SUBMESH) as RF3D.RF3DSubmesh[]
                        for (let submeshSect of itemModelSections)
                            for (let material of submeshSect.materials)
                                this.addTexture(device, renderer, material.diffuseMapName, vppCombined)

                    }

                    renderer.addClutterRenderer(device, new ClutterRenderer(device, renderer.textureHolder, entityModelDatas[entityName], entityEntry, undefined));
                }
            }//*/

            const sceneRenderer = new SceneRenderer(device, renderer.textureHolder, rflData);
            
            console.log(sceneRenderer)
            renderer.addSceneRenderer(device, sceneRenderer);
            return renderer;//*/
        });
    }
}

const id = `redfaction`;
const name = "Red Faction";
const sceneDescs = [
	new SceneDesc(`train01`, `train01`, `levels1`),
	new SceneDesc(`train02`, `train02`, `levels1`),
	new SceneDesc(`L1S1`, `L1S1`, `levels1`),
	new SceneDesc(`L1S2`, `L1S2`, `levels1`),
	new SceneDesc(`L1S3`, `L1S3`, `levels1`),
	new SceneDesc(`L2S1`, `L2S1`, `levels1`),
	new SceneDesc(`L2S2a`, `L2S2a`, `levels1`),
	new SceneDesc(`L2S3`, `L2S3`, `levels1`),
	new SceneDesc(`L3S1`, `L3S1`, `levels1`),
	new SceneDesc(`L3S2`, `L3S2`, `levels1`),
	new SceneDesc(`L3S3`, `L3S3`, `levels1`),
	new SceneDesc(`L3S4`, `L3S4`, `levels1`),
	new SceneDesc(`L4S1a`, `L4S1a`, `levels1`),
	new SceneDesc(`L4S1b`, `L4S1b`, `levels1`),
	new SceneDesc(`L4S2`, `L4S2`, `levels1`),
	new SceneDesc(`L4S3`, `L4S3`, `levels1`),
	new SceneDesc(`L4S4`, `L4S4`, `levels1`),
	new SceneDesc(`L4S5`, `L4S5`, `levels1`),
	new SceneDesc(`L5S1`, `L5S1`, `levels1`),
	new SceneDesc(`L5SS2`, `L5SS2`, `levels1`),
	new SceneDesc(`L5S3`, `L5S3`, `levels1`),
	new SceneDesc(`L5S4`, `L5S4`, `levels1`),
	new SceneDesc(`L6S1`, `L6S1`, `levels1`),
	new SceneDesc(`L6S2`, `L6S2`, `levels1`),
	new SceneDesc(`L6S3`, `L6S3`, `levels1`),
	new SceneDesc(`L7S1`, `L7S1`, `levels2`),
	new SceneDesc(`L7S2`, `L7S2`, `levels2`),
	new SceneDesc(`L7S3`, `L7S3`, `levels2`),
	new SceneDesc(`L7S4`, `L7S4`, `levels2`),
	new SceneDesc(`L8S1`, `L8S1`, `levels2`),
	new SceneDesc(`L8S2`, `L8S2`, `levels2`),
	new SceneDesc(`L8S3`, `L8S3`, `levels2`),
	new SceneDesc(`L8S4`, `L8S4`, `levels2`),
	new SceneDesc(`L9S1`, `L9S1`, `levels2`),
	new SceneDesc(`L9S2`, `L9S2`, `levels2`),
	new SceneDesc(`L9S3`, `L9S3`, `levels2`),
	new SceneDesc(`L9S4`, `L9S4`, `levels2`),
	new SceneDesc(`L10S1`, `L10S1`, `levels2`),
	new SceneDesc(`L10S2`, `L10S2`, `levels2`),
	new SceneDesc(`L10S3`, `L10S3`, `levels2`),
	new SceneDesc(`L10S4`, `L10S4`, `levels2`),
	new SceneDesc(`L11S1`, `L11S1`, `levels2`),
	new SceneDesc(`L11S2`, `L11S2`, `levels2`),
	new SceneDesc(`L11S3`, `L11S3`, `levels2`),
	new SceneDesc(`L12S1`, `L12S1`, `levels2`),
	new SceneDesc(`L12S2`, `L12S2`, `levels2`),
	new SceneDesc(`L13S1`, `L13S1`, `levels3`),
	new SceneDesc(`L13S3`, `L13S3`, `levels3`),
	new SceneDesc(`L14S1`, `L14S1`, `levels3`),
	new SceneDesc(`L14S2`, `L14S2`, `levels3`),
	new SceneDesc(`L14S3`, `L14S3`, `levels3`),
	new SceneDesc(`L15S1`, `L15S1`, `levels3`),
	new SceneDesc(`L15S2`, `L15S2`, `levels3`),
	new SceneDesc(`L15S4`, `L15S4`, `levels3`),
	new SceneDesc(`L17S1`, `L17S1`, `levels3`),
	new SceneDesc(`L17S2`, `L17S2`, `levels3`),
	new SceneDesc(`L17S3`, `L17S3`, `levels3`),
	new SceneDesc(`L17S4`, `L17S4`, `levels3`),
	new SceneDesc(`L18S1`, `L18S1`, `levels3`),
	new SceneDesc(`L18S2`, `L18S2`, `levels3`),
	new SceneDesc(`L18S3`, `L18S3`, `levels3`),
	new SceneDesc(`L19S1`, `L19S1`, `levels3`),
	new SceneDesc(`L19S2A`, `L19S2A`, `levels3`),
	new SceneDesc(`L19S2B`, `L19S2B`, `levels3`),
	new SceneDesc(`L19S3`, `L19S3`, `levels3`),
	new SceneDesc(`L20S1`, `L20S1`, `levels2`),
	new SceneDesc(`L20S2`, `L20S2`, `levels2`),
	new SceneDesc(`L20S3`, `L20S3`, `levels2`),
	new SceneDesc(`glass_house`, `glass_house`, `levelsm`),
	new SceneDesc(`ctf01`, `ctf01`, `levelsm`),
	new SceneDesc(`ctf02`, `ctf02`, `levelsm`),
	new SceneDesc(`ctf03`, `ctf03`, `levelsm`),
	new SceneDesc(`ctf04`, `ctf04`, `levelsm`),
	new SceneDesc(`ctf05`, `ctf05`, `levelsm`),
	new SceneDesc(`ctf06`, `ctf06`, `levelsm`),
	new SceneDesc(`ctf07`, `ctf07`, `levelsm`),
	new SceneDesc(`dm01`, `dm01`, `levelsm`),
	new SceneDesc(`dm02`, `dm02`, `levelsm`),
	new SceneDesc(`dm03`, `dm03`, `levelsm`),
	new SceneDesc(`dm04`, `dm04`, `levelsm`),
	new SceneDesc(`dm05`, `dm05`, `levelsm`),
	new SceneDesc(`dm06`, `dm06`, `levelsm`),
	new SceneDesc(`dm07`, `dm07`, `levelsm`),
	new SceneDesc(`dm08`, `dm08`, `levelsm`),
	new SceneDesc(`dm09`, `dm09`, `levelsm`),
	new SceneDesc(`dm10`, `dm10`, `levelsm`),
	new SceneDesc(`dm11`, `dm11`, `levelsm`),
	new SceneDesc(`dm12`, `dm12`, `levelsm`),
	new SceneDesc(`dm13`, `dm13`, `levelsm`),
	new SceneDesc(`dm14`, `dm14`, `levelsm`),
	new SceneDesc(`dm15`, `dm15`, `levelsm`),
	new SceneDesc(`dm16`, `dm16`, `levelsm`),
	new SceneDesc(`dm17`, `dm17`, `levelsm`),
	new SceneDesc(`dm18`, `dm18`, `levelsm`),
	new SceneDesc(`dm19`, `dm19`, `levelsm`),
	new SceneDesc(`dm20`, `dm20`, `levelsm`),

    //new SceneDesc(`untitled`, `untitled`, 'untitled'),
    //new SceneDesc(`pdm-railway run`, `railway run`, `pdm-railway run`),
    //new SceneDesc(`clut1`, `clut1`, 'clut1'),
    //new SceneDesc(`clut2`, `clut2`, 'clut2'),
    //new SceneDesc(`clut3`, `clut3`, 'clut3'),
    //new SceneDesc(`DM-MVF-Run`, `MVF Run`, `DM-MVF-Run`),
    //new SceneDesc(`DM-GRU-Run`, `GRU Run`, `DM-GRU-Run`),
    //new SceneDesc(`pdm-mg-run`, `mg run`, `pdm-mg-run`),
    //new SceneDesc(`3bnt`, `3-brushes, non-triangulated`, 'small-to-big'), //2 square brushes, 1 rectangular brush, non-triangulated; 4-6 verts per face
    //new SceneDesc(`1bt`, `1 brush, triangulated`, 'small-to-big-tri'), //1 square brush, triangulated; 3 verts per face
    //new SceneDesc(`1bnt`, `1 brush, non-triangulated`, 'single-brush-no-tri'), //1 square brush, nottriangulated; 4 verts per face
    //new SceneDesc(`cylin`, `cylinder non-tri`, 'cylinder'), //1 square brush, nottriangulated; 4 verts per face
];

export const sceneGroup: Viewer.SceneGroup = { id, name, sceneDescs };
