
import ArrayBufferSlice from "../ArrayBufferSlice";
import { DataStream } from "./DataStream";
import { assert } from "../util";
import { AABB } from "../Geometry";
import { vec3, vec4, vec2, mat3 } from "gl-matrix";
import { GfxTopology } from "../gfx/helpers/TopologyHelpers";

enum RFLViewportTypes {
    FREE_LOOK,
    TOP,
    BOTTOM,
    FRONT,
    BACK,
    LEFT,
    RIGHT,
}

export enum RFLSections {
    END = 0x00000000,
    STATIC_GEOMETRY = 0x00000100,
    GEO_REGIONS = 0x00000200,
    LIGHTS = 0x00000300,
    CUTSCENE_CAMERAS = 0x00000400,
    AMBIENT_SOUNDS = 0x00000500,
    EVENTS = 0x00000600,
    MULTIPLAYER_RESPAWNS = 0x00000700,
    LEVEL_PROPERTIES = 0x00000900,
    PARTICLE_EMITTERS = 0x00000A00,
    GAS_REGIONS = 0x00000B00,
    ROOM_EFFECTS = 0x00000C00,
    CLIMBING_REGIONS = 0x00000D00,
    BOLT_EMITTERS = 0x00000E00,
    TARGETS = 0x00000F00,
    DECALS = 0x00001000,
    PUSH_REGIONS = 0x00001100,
    LIGHTMAPS = 0x00001200,
    MOVERS = 0x00002000,
    MOVING_GROUPS = 0x00003000,
    CUTSCENES = 0x00004000,
    CUTSCENE_PATH_NODES = 0x00005000,
    CUTSCENE_PATHS = 0x00006000,
    TGA_UNKNOWN = 0x00007000,
    VCM_UNKNOWN = 0x00007001,
    MVF_UNKNOWN = 0x00007002,
    V3D_UNKNOWN = 0x00007003,
    VFX_UNKNOWN = 0x00007004,
    EAX_EFFECTS = 0x00008000,
    WAYPOINT_LISTS = 0x00010000,
    NAV_POINT_LISTS = 0x00020000,
    ENTITIES = 0x00030000,
    ITEMS = 0x00040000,
    CLUTTERS = 0x00050000,
    TRIGGERS = 0x00060000,
    PLAYER_START = 0x00070000,
    LEVEL_INFO = 0x01000000,
    BRUSHES = 0x02000000,
    GROUPS = 0x03000000,
    EDITOR_ONLY_LIGHTS = 0x04000000,
}

export interface RF1BaseInterface { type: RFLSections }
interface RF1Bytes extends RF1BaseInterface { data: ArrayBufferSlice }

interface RF1LevelProperties extends RF1BaseInterface {
    geomodTexture: string
    hardness: number
    ambientColor: vec4
    unknown: number
    fogColor: vec4
    fogNearClipPlane: number
    fogFarClipPlane: number
}

interface RF1GeoRegions extends RF1BaseInterface { geoRegions: RF1GeoRegion[] }
interface RF1GeoRegion {
    uid: number
    flags: RF1GeoRegionFlags
    unknown: ArrayBufferSlice
    shallowGeomodDepth?: number
    xyz: vec3
    radius?: number
    rotMatrix?: mat3
    dimensions?: vec3
}

enum RF1GeoRegionFlags {
    SPHERE = 2,
    BOX = 4,
    USE_SHALLOW_GEOMODS = 0x20,
    ICE = 0x40,
}


interface RF1Lights extends RF1BaseInterface { lights: RF1Light[] }
interface RF1EditorOnlyLights extends RF1BaseInterface { lights: RF1Light[] }
interface RF1Light {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    flags1: RF1LightFlags1
    flags2: RF1LightFlags2
    unknown2: number
    unknown3: number
    lightColor: vec4
    range: number
    fov: number
    fovDropoff: number
    intensityAtMaxRange: number
    dropoff: RF1LightDropoffTypes
    tubeWidth: number
    lightOnIntensity: number
    lightOnTime: number
    lightOnTimeVariance: number
    lightOffIntensity: number
    lightOffTime: number
    lightOffTimeVariance: number
}

enum RF1LightFlags1 {
    DYNAMIC = 1,
    FADE = 2,
    SHADOW_CASTING = 4,
    IS_ENABLED = 8,
    TYPE_OMNIDIRECTIONAL = 0x10,
    TYPE_CIRCULAR_SPOTLIGHT = 0x20,
    TYPE_TUBE_LIGHT = 0x30,
}

enum RF1LightFlags2 {
    INITIAL_LIGHT_STATE_OFF = 1,
    INITIAL_LIGHT_STATE_ON = 2,
    INITIAL_LIGHT_STATE_OFF_ALTERNATING = 3,
    INITIAL_LIGHT_STATE_ON_ALTERNATING = 4,
    RUNTIME_SHADOW = 0x20,
}

enum RF1LightDropoffTypes {
    LINEAR = 0,
    SQUARED = 1,
    COSINE = 2,
    SQUARE_ROOT = 3,
}

interface RF1CutsceneCameras extends RF1BaseInterface { cameras: RF1CutsceneCamera[] }
interface RF1CutsceneCamera {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
}

interface RF1AmbientSounds extends RF1BaseInterface { ambientSounds: RF1AmbientSound[] }
interface RF1AmbientSound {
    uid: number
    xyz: vec3
    unknown: number
    soundFileName: string
    minDist: number
    volumeScale: number
    rolloff: number
    startDelay: number
}

interface RF1Events extends RF1BaseInterface { events: RF1Event[] }
interface RF1Event {
    uid: number
    className: string
    xyz: vec3
    scriptName: string
    unknown: number
    delay: number
    bool1: number
    bool2: number
    int1: number
    int2: number
    float1: number
    float2: number
    string1: string
    string2: string
    linkCount: number
    links: number[]
    rotMatrix?: mat3
    color: vec4
}

interface RF1MultiplayerRespawns extends RF1BaseInterface { multiplayerRespawns: RF1MultiplayerRespawn[] }
interface RF1MultiplayerRespawn {
    uid: number
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    team: number
    redTeam: number
    blueTeam: number
    bot: number
}

interface RF1ParticleEmitters extends RF1BaseInterface { particleEmitters: RF1ParticleEmitter[] }
interface RF1ParticleEmitter {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    type: RF1ParticleEmitterTypes
    sphereRadius: number
    planeWidth: number
    planeDepth: number
    particleBitmap: string
    spawnDelay: number
    spawnDelayVariance: number
    velocity: number
    velocityVariance: number
    acceleration: number
    decay: number
    decayVariance: number
    particleRadius: number
    particleRadiusVariance: number
    growthRate: number
    gravityMultiplier: number
    randomDirection: number
    particleColor: vec4
    fadeToColor: vec4
    flags: RF1ParticleEmitterEmitterFlags
    unknown2: ArrayBufferSlice
    particleFlags1: RF1ParticleEmitterParticleFlags1
    particleFlags2: RF1ParticleEmitterParticleFlags2
    bouncinessAndStickiness: number
    swirlinessAndPushEffect: number
    emitterInitiallyOn: number
    emitterOnTime: number
    emitterOnTimeVariance: number
    emitterOffTime: number
    emitterOffTimeVariance: number
    activeDistance: number
}

enum RF1ParticleEmitterTypes {
    undefined = 0,
    plane = 1,
    sphere = 2,
}

enum RF1ParticleEmitterEmitterFlags {
    FORCE_SPAWN_EVERY_FRAME = 4,
    DIRECTION_DEPENDENT_VELOCITY = 8,
    EMITTER_IS_INITIALLY_ON = 0x10,
    EMITTER_FLIPS_AND_FLOPS = 0x20, //#emitter switches between on/off using on/off time
}

enum RF1ParticleEmitterParticleFlags1 {
    GLOW = 2,
    FADE = 4,
    GRAVITY = 8,
    COLLIDE_WITH_WORLD = 0x10,
    ACCELERATION_NON_ZERO = 0x40,
    EXPLODE_ON_IMPACT = 0x80,
}

enum RF1ParticleEmitterParticleFlags2 {
    LOOP_ANIMATION = 1,
    RANDOM_ORIENT = 2,
    COLLIDE_WITH_LIQUIDS = 4,
    DIE_ON_IMPACT = 8,
    PLAY_COLLISION_SOUNDS = 0x10,
}

interface RF1GasRegions extends RF1BaseInterface { gasRegions: RF1GasRegion[] }
interface RF1GasRegion {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    type: RF1GasRegionTypes
    radius?: number
    dimensions?: vec3
    gasColor: vec4
    gasDensity: number
}

enum RF1GasRegionTypes {
    UNDEFINED = 0,
    SPHERE = 1,
    BOX = 2,
}

interface RF1RoomEffects extends RF1BaseInterface { roomEffects: RF1RoomEffect[] }
interface RF1RoomEffect {
    type: RF1RoomEffectTypes
    ambientLightColor?: vec4
    liquidRoomEffectProperties?: RF1LiquidRoomEffectProperties
    isCold: number
    isOutside: number
    isAirlock: number
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
}

interface RF1LiquidRoomEffectProperties {
    waveformType: RF1LiquidRoomWaveformTypes
    depth: number
    surfaceBitmap: string
    liquidColor: vec4
    visibility: number
    liquidType: RF1LiquidRoomLiquidTypes
    containsPlankton: number
    surfaceTexturePixelsPerMeter: vec2
    textureAngle: number
    surfaceTextureScrollRate: vec2
}

enum RF1RoomEffectTypes {
    UNDEFINED = 0,
    SKY_ROOM = 1,
    LIQUID_ROOM = 2,
    AMBIENT_LIGHT = 3,
    NONE = 4,
}

enum RF1LiquidRoomWaveformTypes {
    UNDEFINED = 0,
    NONE = 1,
    CALM = 2,
    CHOPPY = 3,
}

enum RF1LiquidRoomLiquidTypes {
    UNDEFINED = 0,
    WATER = 1,
    LAVA = 2,
    ACID = 3
}

interface RF1ClimbingRegions extends RF1BaseInterface { climbingRegions: RF1ClimbingRegion[] }
interface RF1ClimbingRegion {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    type: RF1ClimbingRegionTypes
    dimensions: vec3
}

enum RF1ClimbingRegionTypes {
    UNDEFINED = 0,
    LADDER = 1,
    CHAIN_FENCE = 2,
}

interface RF1BoltEmitters extends RF1BaseInterface { boltEmitters: RF1BoltEmitter[] }
interface RF1BoltEmitter {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    targetUid: number
    sourceControlDistance: number
    targetControlDistance: number
    thickness: number
    jitter: number
    numberSegments: number
    spawnDelay: number
    spawnDelayVariance: number
    decay: number
    decayVariance: number
    boltColor: vec4
    boltBitmap: string
    flags: RF1BoltEmitterFlags
    unknown2: ArrayBufferSlice
    initiallyOn: number
}

enum RF1BoltEmitterFlags {
    FADE = 2,
    GLOW = 4,
    SOURCE_DESTINATION_LOCKED = 8,
    TARGET_DESTINATION_LOCKED = 0x10,
}

interface RF1Targets extends RF1BaseInterface { targets: RF1Target[] }
interface RF1Target {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
}

interface RF1Decals extends RF1BaseInterface { decals: RF1Decal[] }
interface RF1Decal {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    dimensions: vec3
    decalBitmap: string
    alpha: number
    unknown2: ArrayBufferSlice
    selfIlluminated: number
    tiling: RF1DecalTiling
    unknown3: ArrayBufferSlice
    scale: number
}

enum RF1DecalTiling {
    NONE = 0,
    U = 1,
    V = 2,
}

interface RF1PushRegions extends RF1BaseInterface { pushRegions: RF1PushRegion[] }
interface RF1PushRegion {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    type: RF1PushRegionTypes
    radius?: number
    dimensions?: vec3
    strength: number
    flags: RF1PushRegionFlags
    unknown2: number
    turbulence: number
}

enum RF1PushRegionTypes {
    SPHERE = 1,
    AXIS_ALIGNED_BOUNDING_BOX = 2,
    ORIENTED_BOUNDING_BOX = 3
}

enum RF1PushRegionFlags {
    CONSTANT_INTENSITY = 0,
    MASS_INDEPENDENT = 1,
    GROUNDED = 2,
    INTENSITY_GROWS_TOWARDS_REGION_CENTER = 4,
    INTENSITY_GROWS_TOWARDS_REGION_BOUNDATIES = 8,
    RADIAL = 0x10,
    DOESNT_AFFECT_PLAYER = 0x20,
    JUMP_PAD = 0x40,
}

export interface RF1Lightmaps extends RF1BaseInterface { lightmaps: RF1Lightmap[] }
interface RF1Lightmap {
    width: number
    height: number
    bitmap: ArrayBufferSlice
}

export interface RF1Movers extends RF1BaseInterface { movers: RF1Brush[] }
interface RF1Brushes extends RF1BaseInterface { brushes: RF1Brush[] }
export interface RF1Brush {
    uid: number
    xyz: vec3
    rotMatrix: mat3
    unknown1a: ArrayBufferSlice
    unknown1b?: ArrayBufferSlice // version >= 0xC8
    textureCount: number
    textures: string[]

    //#16 thing
    unknown2Count: number
    unknown2: ArrayBufferSlice
    unknown3: ArrayBufferSlice
    //#16 thing

    vertexCount: number
    vertices: vec3[]

    faceCount: number
    faces: RF1Face[]

    unknown4Count: number
    unknown4: RF1BrushUnknown4[]

    unknownOlderBrushesCount?: number
    unknownOlderBrushes?: RF1BrushUnknownOlderBrush[]

    flags: RF1BrushFlags
    life: number
    state: RF1BrushState
}

interface RF1BrushUnknown4 {
    helper: number
    bytes: ArrayBufferSlice
    float1: number
    float2: number
}

interface RF1BrushUnknownOlderBrush {
    unknown: number[]
}

interface RF1Face {
    normalVector: vec3
    distance: number
    texture: number
    unknownLightmap: number
    unknown: number
    unknown2: ArrayBufferSlice
    unknownPortal: number
    flags: RF1FaceFlags
    lightmapResolution: RF1LightmapResolution
    unknown3: ArrayBufferSlice
    smoothingGroupFlags: ArrayBufferSlice
    roomIndex: number
    vertexCount: number
    vertices: RF1Vertex[]
}

export interface RF1Vertex {
    index: number
    textureUV: vec2
    lightUV?: vec2 //if unknownLightmap != -1
}

export enum RF1BrushFlags { //#"unused"
    PORTAL = 1,
    AIR = 2,
    DETAIL = 4,
    EMIT_STEAM = 0x10,
}

enum RF1BrushState { //#"unused"
    NORMAL = 0,
    HIDDEN = 1,
    LOCKED = 2,
    SELECTED = 3,
}

export enum RF1FaceFlags { //#"unused"
    SHOW_SKY = 1,
    MIRRORED = 2,
    UNKNOWN = 4,
    UNKNOWN2 = 8,
    FULL_BRIGHT = 0x20,
    UNKNOWN3 = 0x40,
    UNKNOWN4 = 0x80,
    MASK = 0xEF, //# SHOW_SKY | MIRRORED | ...
}

enum RF1LightmapResolution {
    DEFAULT = 1,
    LOWEST = 8,
    LOW = 9,
    HIGH = 0xA,
    HIGHEST = 0xB,
}

interface RF1MovingGroups extends RF1BaseInterface { movingGroups: RF1Group[] }
interface RF1Groups extends RF1BaseInterface { groups: RF1Group[] }
interface RF1Group {
    name: string
    unknown: number
    type: RF1GroupTypes
    moverInfo?: RF1MovingGroupInfo
    objectCount: number
    objects: number[]
    brushCount: number
    brushes: number[]
}

interface RF1MovingGroupInfo {
    keyframeCount: number
    keyframes: RF1Keyframe[]
    itemCount: number
    items: RF1MovingGroupItem[]
    moverProperties: RF1MoverProperties
}

interface RF1Keyframe {
    uid: number
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    pauseTime: number
    departTime: number
    returnTime: number
    accelTime: number
    decelTime: number
    triggerEvent: number
    containsItem1: number
    containsItem2: number
    rotateDegrees: number
}

interface RF1MovingGroupItem {
    uid: number
    offset: vec3
    rotation: mat3
}

interface RF1MoverProperties {
    isDoor: number
    rotateInPlace: number
    startMovingBackwards: number
    useTravelTimeAsVelocity: number
    forceOrient: number
    noPlayerCollide: number
    movementType: RF1KeyframeMovementTypes
    startingKeyframeIndex: number
    soundStartFile: string
    soundStartVolume: number
    soundLoopFile: string
    soundLoopVolume: number
    soundStopFile: string
    soundStopVolume: number
    soundCloseFile: string
    soundCloseVolume: number
}

enum RF1KeyframeMovementTypes {
    UNDEFINED = 0,
    ONE_WAY = 1,
    PING_PONG_ONCE = 2,
    PING_PONG_INFINITE = 3,
    LOOP_ONCE = 4,
    LOOP_INFINITE = 5,
    LIFT = 6,
}

enum RF1GroupTypes {
    USER_DEFINED = 0,
    MOVING = 1,
}

interface RF1Cutscenes extends RF1BaseInterface { cutscenes: RF1Cutscene[] }
interface RF1Cutscene {
    uid: number
    hidePlayer: number
    fov: number
    numberShots: number
    shots: RF1CutsceneShot[]
}

interface RF1CutsceneShot {
    cameraUid: number
    preWait: number
    pathTime: number
    postWait: number
    lookAtUid: number
    triggerUid: number
    pathName: string
}

interface RF1CutscenePathNodes extends RF1BaseInterface { cutscenePathNodes: RF1CutscenePathNode[] }
interface RF1CutscenePathNode {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
}

interface RF1CutscenePaths extends RF1BaseInterface { cutscenePaths: RF1CutscenePath[] }
interface RF1CutscenePath {
    pathName: string
    pathNodeCount: number
    pathNodes: number[]
}

interface RF1TGAUnknowns extends RF1BaseInterface { TGAs: string[]}

interface RF1vmvvUnks extends RF1BaseInterface { vmmvUnk: RF1vmvvUnk }
interface RF1vmvvUnk {
    //TODO: figure out what these sections are used for, then potentially combine with TGAUnknowns
    strings: string[]
    unknowns: number[]
}

interface RF1eaxEffects extends RF1BaseInterface { eaxEffects: RF1eaxEffect[] }
interface RF1eaxEffect {
    effectName: string
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
}

interface RF1WaypointLists extends RF1BaseInterface { waypointLists: RF1WaypointList[] }
interface RF1WaypointList {
    name: string
    waypointCount: number
    navPointIndex: number[]
}

interface RF1NavPointLists extends RF1BaseInterface { navPointLists: RF1NavPointList }
interface RF1NavPointList {
    navPoints: RF1NavPoint[]
    navPointConnections: number[][]
}

interface RF1NavPoint {
    uid: number
    unknown: number
    height: number
    xyz: vec3
    radius: number
    unknown2: ArrayBufferSlice
    directional: number
    rotMatrix?: mat3
    cover: number
    hide: number
    crouch: number
    pauseTime: number
    linkCount: number
    links: number[]
}

export interface RF1Entities extends RF1BaseInterface { entities: RF1Entity[] }
export interface RF1Entity {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    cooperation: number
    friendliness: number
    teamID: number
    waypointList: string
    waypointMethod: string
    unknown2: number
    boarded: number
    readyToFireState: number
    onlyAttackPlayer: number
    weaponIsHolstered: number
    deaf: number
    sweepMinAngle: number
    sweepMaxAngle: number
    ignoreTerrainWhenFiring: number
    unknown3: number
    startCrouched: number
    life: number
    armor: number
    fov: number
    defaultPrimaryWeapon: string
    defaultSecondaryWeapon: string
    itemDrop: string
    stateAnim: string
    corpsePose: string
    skin: string
    deathAnim: string
    aiMode: number
    aiAttackStyle: number
    unknown4: ArrayBufferSlice
    turretUID: number
    alertCameraUID: number
    alarmEventUID: number
    run: number
    startHidden: number
    wearHelmet: number
    endGameIfKilled: number
    coverFromWeapon: number
    questionUnarmedPlayer: number
    dontHum: number
    noShadow: number
    alwaysSimulate: number
    perfectAim: number
    permanentCorpse: number
    neverFly: number
    neverLeave: number
    noPersonaMessages: number
    fadeCorpseImmediately: number
    neverCollideWithPlayer: number
    useCustomAttackRange: number
    customAttackRange?: number
    leftHandHolding: string
    rightHandHolding: string
}

export interface RF1Items extends RF1BaseInterface { items: RF1Item[] }
export interface RF1Item {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: number
    count: number
    respawnTime: number
    teamID: number
}

export interface RF1Clutters extends RF1BaseInterface { clutters: RF1Clutter[] }
export interface RF1Clutter {
    uid: number
    className: string
    xyz: vec3
    rotMatrix: mat3
    scriptName: string
    unknown: ArrayBufferSlice
    skin: string
    linkCount: number
    links: number[]
}

interface RF1Triggers extends RF1BaseInterface { triggers: RF1Trigger[] }
interface RF1Trigger {
    uid: number
    scriptName: string
    unknown: number
    isBox: number
    unknown2: ArrayBufferSlice
    resetsAfter: number
    resetsCount: number
    unknown3: number
    useKeyIsRequiredToActivateTrigger: number
    keyName: string
    playerWeaponActivatesTrigger: number
    activatedBy: RF1TriggerActivatedBy
    isNpc: number
    isAuto: number
    playerInVehicle: number
    xyz: vec3
    sphereRadius?: number
    rotationMatrix?: mat3
    boxDimensions?: vec3
    oneWay?: number
    airlockRoomUID: number
    attachedToUID: number
    useClutterUID: number
    disabled: number
    buttonActiveTime: number
    insideTime: number
    team: number
    linkCount: number
    links: number[]
}

enum RF1TriggerActivatedBy {
    PLAYERS_ONLY = 0,
    ALL_OBJECTS = 1,
    LINKED_OBJECTS = 2,
    AI_ONLY = 3,
    PLAYER_VEHICLE_ONLY = 4,
    GEOMODS = 5,
}

interface RF1PlayerStart extends RF1BaseInterface {
    xyz: vec3
    rotMatrix: mat3
}

interface RFLLevelInfo extends RF1BaseInterface {
    unknown: number
    levelName: string
    author: string
    date: string
    unknown2: number
    multiplayerLevel: number
    viewports: RFLViewport[] //TL -> TR -> BL -> BR
}

interface RFLViewport {
    type: RFLViewportTypes
    zoom?: number
    xyz: vec3
    rotMatrix: mat3
}

export interface RF1Rooms extends RF1BaseInterface {
    unknown: ArrayBufferSlice
    textureCount: number
    textures: string[]
    scrollCount: number
    scrolls: RF1FaceScroll[]
    roomCount: number
    rooms: RF1Room[]
    unknown2Count: number
    unknown2: RF1RoomsUnknown2[] //equal to roomcount, only compiled geometry
    unknown3Count: number
    unknown3: ArrayBufferSlice
    vertexCount: number
    vertices: vec3[]
    faceCount: number
    faces: RF1Face[]
    unknownLightmapCount: number
    unknownLightmaps: RF1RoomsUnknownLightmap[]
    unknown4?: number
    unknown5?: number[]
}

interface RF1FaceScroll {
    faceID: number
    uvVelocity: vec2
}

interface RF1Room {
    id: number
    aabb: AABB
    skyRoom: number
    cold: number
    outside: number
    airlock: number
    liquidRoom: number
    ambientLight: number
    subRoom: number
    unknown: number
    life: number
    eaxEffect: string
    liquidRoomProperties?: RF1LiquidRoomProperties
    ambientColor?: vec4
}

interface RF1LiquidRoomProperties {
    depth: number
    color: vec4
    surfaceTexture: string
    visibility: number
    type: RF1LiquidRoomLiquidTypes
    alpha: number
    unknown: ArrayBufferSlice
    waveform: number
    surfaceTextureScroll: vec2
}

interface RF1RoomsUnknown2 {
    meshIndex: number
    linkCount: number //contained meshes?
    links: number[]
}

export interface RF1RoomsUnknownLightmap {
    lightmap: number
    unknown: ArrayBufferSlice
    faces: number //index in faces
}

//////////////////////////////////////////////////////

interface RF1ContainerItems extends RF1BaseInterface { containerItems: RF1ContainerItem[] }
interface RF1ContainerItem {
}

//////////////////////////////////////////////////////

function parseRF1Face(stream: DataStream): RF1Face {
    let face = <RF1Face>{}
    face.normalVector = stream.readEVec3Float()
    face.distance = stream.readFloat32()
    face.texture =  stream.readUint32()
    face.unknownLightmap = stream.readInt32()
    face.unknown = stream.readUint32()
    face.unknown2 = stream.readSlice(8)
    face.unknownPortal = stream.readUint32() //not 0 for portals
    face.flags = stream.readUint8()
    face.lightmapResolution = stream.readUint8()
    face.unknown3 = stream.readSlice(2)
    face.smoothingGroupFlags = stream.readSlice(4)
    face.roomIndex = stream.readUint32()
    face.vertexCount = stream.readUint32()
    face.vertices = []
    for (let i = 0; i < face.vertexCount; i++) {
        let vertex = <RF1Vertex>{}
        vertex.index = stream.readUint32() //index in rooms section (vertices)
        vertex.textureUV = stream.readEVec2Float()
        if (face.unknownLightmap != -1)
            vertex.lightUV = stream.readEVec2Float()
        face.vertices.push(vertex)
    }
    return face
}

function parseRFLRooms(stream: DataStream, sectionType: RFLSections, version: number): RF1Rooms {
    const rooms = <RF1Rooms>{}
    rooms.type = sectionType
    if (version <= 0xB4)
        rooms.unknown = stream.readSlice(6)
    else
        rooms.unknown = stream.readSlice(10)

    rooms.textureCount = stream.readUint32()
    rooms.textures = []
    for (let i = 0; i < rooms.textureCount; i++)
        rooms.textures.push(stream.readRF1String())
    
    rooms.scrollCount = stream.readUint32()
    rooms.scrolls = []
    for (let i = 0; i < rooms.scrollCount; i++) {
        const scroll = <RF1FaceScroll>{}
        scroll.faceID = stream.readUint32()
        scroll.uvVelocity = stream.readEVec2Float()
        rooms.scrolls.push(scroll)
    }

    rooms.roomCount = stream.readUint32()
    rooms.rooms = []
    for (let i = 0; i < rooms.roomCount; i++) {
        const room = <RF1Room>{}
        room.id = stream.readUint32()
        room.aabb = stream.readAABB()
        room.skyRoom = stream.readInt8()
        room.cold = stream.readInt8()
        room.outside = stream.readInt8()
        room.airlock = stream.readInt8()
        room.liquidRoom = stream.readInt8()
        room.ambientLight = stream.readInt8()
        room.subRoom = stream.readInt8()
        room.unknown = stream.readInt8()
        room.life = stream.readFloat32()
        room.eaxEffect = stream.readRF1String()
        if (room.liquidRoom === 1) {
            const lrp = <RF1LiquidRoomProperties>{}
            lrp.depth = stream.readFloat32()
            lrp.color = stream.readEVec4Uint8()
            lrp.surfaceTexture = stream.readRF1String()
            lrp.visibility = stream.readFloat32()
            lrp.type = stream.readUint32()
            lrp.alpha = stream.readUint32()
            lrp.unknown = stream.readSlice(13)
            lrp.waveform = stream.readFloat32()
            lrp.surfaceTextureScroll = stream.readEVec2Float()
        }
        if (room.ambientLight === 1)
            room.ambientColor = stream.readEVec4Uint8()
        rooms.rooms.push(room)
    }

    //equal to roomCount, only compiled geometry
    rooms.unknown2Count = stream.readUint32()
    rooms.unknown2 = []
    for (let i = 0; i < rooms.unknown2Count; i++) {
        const unk2 = <RF1RoomsUnknown2>{}
        unk2.meshIndex = stream.readUint32()
        unk2.linkCount = stream.readUint32() //contained meshes?
        unk2.links = []
        for (let ii = 0; ii < unk2.linkCount; ii++)
            unk2.links.push(stream.readUint32())
        rooms.unknown2.push(unk2)
    }

    rooms.unknown3Count = stream.readUint32()
    rooms.unknown3 = stream.readSlice(rooms.unknown3Count * 32)

    rooms.vertexCount = stream.readUint32()
    rooms.vertices = []
    for (let i = 0; i < rooms.vertexCount; i++)
        rooms.vertices.push(stream.readEVec3Float())

    rooms.faceCount = stream.readUint32()
    rooms.faces = []
    for (let i = 0; i < rooms.faceCount; i++)
        rooms.faces.push(parseRF1Face(stream))
    
    rooms.unknownLightmapCount = stream.readUint32()
    rooms.unknownLightmaps = []
    for (let i = 0; i < rooms.unknownLightmapCount; i++) {
        const unkLmap = <RF1RoomsUnknownLightmap>{}
        unkLmap.lightmap = stream.readUint32()
        unkLmap.unknown = stream.readSlice(88)
        unkLmap.faces = stream.readUint32() //index in faces
        rooms.unknownLightmaps.push(unkLmap)
    }

    if (version <= 0xB4) {
        rooms.unknown4 = stream.readUint32()
        rooms.unknown5 = []
        for (let i = 0; i < rooms.unknown4 * 3; i++)
            rooms.unknown5.push(stream.readUint32())
    }

    return rooms
}

function parseRFLLights(stream: DataStream): RF1Light[] {
    const lCount = stream.readUint32()
    let lights : RF1Light[] = []
    for (let i = 0; i < lCount; i++) {
        const light = <RF1Light>{}
        light.uid = stream.readInt32()
        light.className = stream.readRF1String()
        light.xyz = stream.readEVec3Float()
        light.rotMatrix = stream.readRotMat()
        light.scriptName = stream.readRF1String()
        light.unknown = stream.readUint8()
        light.flags1 = stream.readUint8()
        light.flags2 = stream.readUint8()
        light.unknown2 = stream.readUint8()
        light.unknown3 = stream.readUint8()
        light.lightColor = stream.readEVec4Uint8()
        light.range = stream.readFloat32()
        light.fov = stream.readFloat32()
        light.fovDropoff = stream.readFloat32()
        light.intensityAtMaxRange = stream.readFloat32()
        light.dropoff = stream.readInt32()
        light.tubeWidth = stream.readFloat32()
        light.lightOnIntensity = stream.readFloat32()
        light.lightOnTime = stream.readFloat32()
        light.lightOnTimeVariance = stream.readFloat32()
        light.lightOffIntensity = stream.readFloat32()
        light.lightOffTime = stream.readFloat32()
        light.lightOffTimeVariance = stream.readFloat32()
        lights.push(light)
    }
    return lights
}

function parseRFLGroups(stream: DataStream): RF1Group[] {
    const groupCount = stream.readUint32()
    let groups : RF1Group[] = []
    for (let i = 0; i < groupCount; i++) {
        const group = <RF1Group>{}
        group.name = stream.readRF1String()
        group.unknown = stream.readInt8()

        group.type = stream.readInt8()
        if (group.type === RF1GroupTypes.MOVING) {
            const mgInfo = <RF1MovingGroupInfo>{}
            mgInfo.keyframeCount = stream.readUint32()
            mgInfo.keyframes = []
            for (let ii = 0; ii < mgInfo.keyframeCount; ii++) {
                const keyframe = <RF1Keyframe>{}
                keyframe.uid = stream.readInt32()
                keyframe.xyz = stream.readEVec3Float()
                keyframe.rotMatrix = stream.readRotMat()
                keyframe.scriptName = stream.readRF1String()
                keyframe.unknown = stream.readInt8()
                keyframe.pauseTime = stream.readFloat32()
                keyframe.departTime = stream.readFloat32()
                keyframe.returnTime = stream.readFloat32()
                keyframe.accelTime = stream.readFloat32()
                keyframe.decelTime = stream.readFloat32()
                keyframe.triggerEvent = stream.readInt32()
                keyframe.containsItem1 = stream.readInt32()
                keyframe.containsItem2 = stream.readInt32()
                keyframe.rotateDegrees = stream.readFloat32()
                mgInfo.keyframes.push(keyframe)
            }

            mgInfo.itemCount = stream.readUint32()
            mgInfo.items = []
            for (let ii = 0; ii < mgInfo.itemCount; ii++) {
                const item = <RF1MovingGroupItem>{}
                item.uid = stream.readInt32()
                item.offset = stream.readEVec3Float()
                item.rotation = stream.readRotMat()
                mgInfo.items.push(item)
            }

            const mProp = <RF1MoverProperties>{}
            mProp.isDoor = stream.readInt8()
            mProp.rotateInPlace = stream.readInt8()
            mProp.startMovingBackwards = stream.readInt8()
            mProp.useTravelTimeAsVelocity = stream.readInt8()
            mProp.forceOrient = stream.readInt8()
            mProp.noPlayerCollide = stream.readInt8()
            mProp.movementType = stream.readUint32()
            mProp.startingKeyframeIndex = stream.readInt32()
            mProp.soundStartFile = stream.readRF1String()
            mProp.soundStartVolume = stream.readFloat32()
            mProp.soundLoopFile = stream.readRF1String()
            mProp.soundLoopVolume = stream.readFloat32()
            mProp.soundStopFile = stream.readRF1String()
            mProp.soundStopVolume = stream.readFloat32()
            mProp.soundCloseFile = stream.readRF1String()
            mProp.soundCloseVolume = stream.readFloat32()
            mgInfo.moverProperties = mProp
            group.moverInfo = mgInfo
        }

        group.objectCount = stream.readUint32()
        group.objects = []
        for (let ii = 0; ii < group.objectCount; ii++)
            group.objects.push(stream.readInt32())

        group.brushCount = stream.readUint32()
            group.brushes = []
            for (let ii = 0; ii < group.brushCount; ii++)
                group.brushes.push(stream.readInt32())
        groups.push(group)
    }
    return groups
}

function parseRF1Brushes(stream: DataStream, version: number): RF1Brush[] {
    const brushCount = stream.readUint32()
    let brushes : RF1Brush[] = []
    for (let i = 0; i < brushCount; i++) {
        const brush = <RF1Brush>{}
        brush.uid = stream.readInt32()
        brush.xyz = stream.readEVec3Float()
        brush.rotMatrix = stream.readRotMat()
        brush.unknown1a = stream.readSlice(6)
        if (version >= 0xC8)
            brush.unknown1b = stream.readSlice(4)
        brush.textureCount = stream.readUint32()
        brush.textures = []
        for (let ii = 0; ii < brush.textureCount; ii++)
            brush.textures.push(stream.readRF1String())

        //#16 thing
        brush.unknown2Count = stream.readUint32()
        brush.unknown2 = stream.readSlice(3*4*brush.unknown2Count)
        brush.unknown3 = stream.readSlice(12)
        //#16 thing

        brush.vertexCount = stream.readUint32()
        brush.vertices = []
        for (let ii = 0; ii < brush.vertexCount; ii++)
            brush.vertices.push(stream.readEVec3Float())

        brush.faceCount = stream.readUint32()
        brush.faces = []
        for (let ii = 0; ii < brush.faceCount; ii++) {
            brush.faces.push(parseRF1Face(stream))
        }

        //unknown order (this seems to come before unknown_older_brushes)
        brush.unknown4Count = stream.readUint32()
        brush.unknown4 = []
        for (let ii = 0; ii < brush.unknown4Count; ii++) {
            let unknown4 = <RF1BrushUnknown4>{}
            unknown4.helper = stream.readUint32()
            unknown4.bytes = stream.readSlice(4*0x15)
            unknown4.float1 = stream.readFloat32()
            unknown4.float2 = stream.readFloat32()
            brush.unknown4.push(unknown4)
        }

        if (version <= 0xB4) {
            brush.unknownOlderBrushesCount = stream.readUint32()
            brush.unknownOlderBrushes = []
            for (let ii = 0; ii < brush.unknownOlderBrushesCount; ii++) {
                let unknownOlderBrush = <RF1BrushUnknownOlderBrush>{}
                unknownOlderBrush.unknown = []
                unknownOlderBrush.unknown.push(stream.readInt32())
                unknownOlderBrush.unknown.push(stream.readInt32())
                unknownOlderBrush.unknown.push(stream.readInt32())
                brush.unknownOlderBrushes.push(unknownOlderBrush)
            }
        }

        brush.flags = stream.readUint32()
        brush.life = stream.readInt32()   //TODO: is this float or not?
        brush.state = stream.readUint32()

        brushes.push(brush)
    }
    return brushes
}

function parseRFLSection(stream: DataStream, sectionType: RFLSections, sectionSize: number, version: number): RF1BaseInterface {
    switch(sectionType) {
        case RFLSections.END:
            return <RF1Bytes>{type: sectionType, data: stream.readSlice(sectionSize)}
        case RFLSections.STATIC_GEOMETRY:
            return parseRFLRooms(stream, sectionType, version)
        case RFLSections.GEO_REGIONS:
            const geoRegionCount = stream.readUint32()
            let geoRegions : RF1GeoRegion[] = []
            for (let i = 0; i < geoRegionCount; i++) {
                const geoRegion = <RF1GeoRegion>{}
                geoRegion.uid = stream.readInt32()
                geoRegion.flags = stream.readInt8()
                geoRegion.unknown = stream.readSlice(3) //flags could be stored as 4 bytes, but only the first byte is used (memory wont help, the flags are stored separately in RED)
                if (geoRegion.flags & RF1GeoRegionFlags.USE_SHALLOW_GEOMODS)
                    geoRegion.shallowGeomodDepth = stream.readFloat32()
                geoRegion.xyz = stream.readEVec3Float()
                if (geoRegion.flags & RF1GeoRegionFlags.SPHERE)
                    geoRegion.radius = stream.readFloat32()
                else {
                    geoRegion.rotMatrix = stream.readRotMat()
                    geoRegion.dimensions = stream.readEVec3Float()
                }
                geoRegions.push(geoRegion)
            }
            return <RF1GeoRegions>{type: sectionType, geoRegions: geoRegions}
        case RFLSections.LIGHTS:
            return <RF1Lights>{type: sectionType, lights: parseRFLLights(stream)}
        case RFLSections.CUTSCENE_CAMERAS:
            const ccCount = stream.readUint32()
            let cCameras : RF1CutsceneCamera[] = []
            for (let i = 0; i < ccCount; i++) {
                const cCamera = <RF1CutsceneCamera>{}
                cCamera.uid = stream.readInt32()
                cCamera.className = stream.readRF1String()
                cCamera.xyz = stream.readEVec3Float()
                cCamera.rotMatrix = stream.readRotMat()
                cCamera.scriptName = stream.readRF1String()
                cCamera.unknown = stream.readInt8()
                cCameras.push(cCamera)
            }
            return <RF1CutsceneCameras>{type: sectionType, cameras: cCameras}
        case RFLSections.AMBIENT_SOUNDS:
            const aSoundCount = stream.readUint32()
            let aSounds : RF1AmbientSound[] = []
            for (let i = 0; i < aSoundCount; i++) {
                const aSound = <RF1AmbientSound>{}
                aSound.uid = stream.readInt32()
                aSound.xyz = stream.readEVec3Float()
                aSound.unknown = stream.readInt8()
                aSound.soundFileName = stream.readRF1String()
                aSound.minDist = stream.readFloat32()
                aSound.volumeScale = stream.readFloat32()
                aSound.rolloff = stream.readFloat32()
                aSound.startDelay = stream.readInt32() //seems to be signed
                aSounds.push(aSound)
            }
            return <RF1AmbientSounds>{type: sectionType, ambientSounds: aSounds}
        case RFLSections.EVENTS:
            const eventCount = stream.readUint32()
            let rEvents : RF1Event[] = []
            for (let i = 0; i < eventCount; i++) {
                const rEvent = <RF1Event>{}
                rEvent.uid = stream.readInt32()
                rEvent.className = stream.readRF1String()
                rEvent.xyz = stream.readEVec3Float()
                rEvent.scriptName = stream.readRF1String()
                rEvent.unknown = stream.readInt8()
                rEvent.delay = stream.readFloat32()
                rEvent.bool1 = stream.readUint8()
                rEvent.bool2 = stream.readUint8()
                rEvent.int1 = stream.readInt32()
                rEvent.int2 = stream.readInt32()
                rEvent.float1 = stream.readFloat32()
                rEvent.float2 = stream.readFloat32()
                rEvent.string1 = stream.readRF1String()
                rEvent.string2 = stream.readRF1String()
                rEvent.linkCount = stream.readUint32()
                rEvent.links = []
                for (let ii = 0; ii < rEvent.linkCount; ii++) {
                    rEvent.links.push(stream.readUint32())
                }
                if (["alarm", "teleport", "teleport_player", "play_vclip"].includes(rEvent.className.toLowerCase())) {
                    rEvent.rotMatrix = stream.readRotMat()
                }
                rEvent.color = stream.readEVec4Uint8()
                rEvents.push(rEvent)
            }
            return <RF1Events>{type: sectionType, events: rEvents}
        case RFLSections.MULTIPLAYER_RESPAWNS:
            const respawnCount = stream.readUint32()
            let mRespawns : RF1MultiplayerRespawn[] = []
            for (let i = 0; i < respawnCount; i++) {
                const mRespawn = <RF1MultiplayerRespawn>{}
                mRespawn.uid = stream.readInt32()
                mRespawn.xyz = stream.readEVec3Float()
                mRespawn.rotMatrix = stream.readRotMat()
                mRespawn.scriptName = stream.readRF1String()
                mRespawn.unknown = stream.readInt8()
                mRespawn.team = stream.readInt32()
                mRespawn.redTeam = stream.readInt8()
                mRespawn.blueTeam = stream.readInt8()
                mRespawn.bot = stream.readInt8()
                mRespawns.push(mRespawn)
            }
            return <RF1MultiplayerRespawns>{type: sectionType, multiplayerRespawns: mRespawns}
        case RFLSections.LEVEL_PROPERTIES:
            const rfLP = <RF1LevelProperties>{}
            rfLP.type = sectionType
            rfLP.geomodTexture = stream.readRF1String()
            rfLP.hardness = stream.readUint32()
            rfLP.ambientColor = stream.readEVec4Uint8()
            rfLP.unknown = stream.readInt8()
            rfLP.fogColor = stream.readEVec4Uint8()
            rfLP.fogNearClipPlane = stream.readFloat32()
            rfLP.fogFarClipPlane = stream.readFloat32()
            return rfLP
        case RFLSections.PARTICLE_EMITTERS:
            const pEmitterCount = stream.readUint32()
            let pEmitters : RF1ParticleEmitter[] = []
            for (let i = 0; i < pEmitterCount; i++) {
                const pEmitter = <RF1ParticleEmitter>{}
                pEmitter.uid = stream.readInt32()
                pEmitter.className = stream.readRF1String()
                pEmitter.xyz = stream.readEVec3Float()
                pEmitter.rotMatrix = stream.readRotMat()
                pEmitter.scriptName = stream.readRF1String()
                pEmitter.unknown = stream.readInt8()
                pEmitter.type = stream.readInt32()
                pEmitter.sphereRadius = stream.readFloat32()
                pEmitter.planeWidth = stream.readFloat32()
                pEmitter.planeDepth = stream.readFloat32()
                pEmitter.particleBitmap = stream.readRF1String()
                pEmitter.spawnDelay = stream.readFloat32()
                pEmitter.spawnDelayVariance = stream.readFloat32()
                pEmitter.velocity = stream.readFloat32()
                pEmitter.velocityVariance = stream.readFloat32()
                pEmitter.acceleration = stream.readFloat32()
                pEmitter.decay = stream.readFloat32()
                pEmitter.decayVariance = stream.readFloat32()
                pEmitter.particleRadius = stream.readFloat32()
                pEmitter.particleRadiusVariance = stream.readFloat32()
                pEmitter.growthRate = stream.readFloat32()
                pEmitter.gravityMultiplier = stream.readFloat32()
                pEmitter.randomDirection = stream.readFloat32()
                pEmitter.particleColor = stream.readEVec4Uint8()
                pEmitter.fadeToColor = stream.readEVec4Uint8()
                pEmitter.flags = stream.readUint8()
                pEmitter.unknown2 = stream.readSlice(3)
                pEmitter.particleFlags1 = stream.readInt8()
                pEmitter.particleFlags2 = stream.readInt8()
                pEmitter.bouncinessAndStickiness = stream.readUint8()
                pEmitter.swirlinessAndPushEffect = stream.readUint8()
                pEmitter.emitterInitiallyOn = stream.readInt8()
                pEmitter.emitterOnTime = stream.readFloat32()
                pEmitter.emitterOnTimeVariance = stream.readFloat32()
                pEmitter.emitterOffTime = stream.readFloat32()
                pEmitter.emitterOffTimeVariance = stream.readFloat32()
                pEmitter.activeDistance = stream.readFloat32()
                pEmitters.push(pEmitter)
            }
            return <RF1ParticleEmitters>{type: sectionType, particleEmitters: pEmitters}
        case RFLSections.GAS_REGIONS:
            const gasRegionCount = stream.readUint32()
            let gasRegions : RF1GasRegion[] = []
            for (let i = 0; i < gasRegionCount; i++) {
                const gasRegion = <RF1GasRegion>{}
                gasRegion.uid = stream.readInt32()
                gasRegion.className = stream.readRF1String()
                gasRegion.xyz = stream.readEVec3Float()
                gasRegion.rotMatrix = stream.readRotMat()
                gasRegion.scriptName = stream.readRF1String()
                gasRegion.unknown = stream.readInt8()
                gasRegion.type = stream.readUint32()
                if (gasRegion.type === RF1GasRegionTypes.SPHERE)
                    gasRegion.radius = stream.readFloat32()
                else
                    gasRegion.dimensions = stream.readEVec3Float()
                gasRegion.gasColor = stream.readEVec4Uint8()
                gasRegion.gasDensity = stream.readFloat32()
                gasRegions.push(gasRegion)
            }
            return <RF1GasRegions>{type: sectionType, gasRegions: gasRegions}
        case RFLSections.ROOM_EFFECTS:
            const rEffectCount = stream.readUint32()
            let rEffects : RF1RoomEffect[] = []
            for (let i = 0; i < rEffectCount; i++) {
                const rEffect = <RF1RoomEffect>{}
                rEffect.type = stream.readUint32()
                if (rEffect.type === RF1RoomEffectTypes.AMBIENT_LIGHT)
                    rEffect.ambientLightColor = stream.readEVec4Uint8()
                if (rEffect.type === RF1RoomEffectTypes.LIQUID_ROOM) {
                    rEffect.liquidRoomEffectProperties = <RF1LiquidRoomEffectProperties>{}
                    rEffect.liquidRoomEffectProperties.waveformType = stream.readUint32()
                    rEffect.liquidRoomEffectProperties.depth = stream.readFloat32()
                    rEffect.liquidRoomEffectProperties.surfaceBitmap = stream.readRF1String()
                    rEffect.liquidRoomEffectProperties.liquidColor = stream.readEVec4Uint8()
                    rEffect.liquidRoomEffectProperties.visibility = stream.readFloat32()
                    rEffect.liquidRoomEffectProperties.liquidType = stream.readUint32()
                    rEffect.liquidRoomEffectProperties.containsPlankton = stream.readInt8()
                    rEffect.liquidRoomEffectProperties.surfaceTexturePixelsPerMeter = stream.readEVec2Int32()
                    rEffect.liquidRoomEffectProperties.textureAngle = stream.readFloat32()
                    rEffect.liquidRoomEffectProperties.surfaceTextureScrollRate = stream.readEVec2Float()
                }
                rEffect.isCold = stream.readInt8()
                rEffect.isOutside = stream.readInt8()
                rEffect.isAirlock = stream.readInt8()
                rEffect.uid = stream.readInt32()
                rEffect.className = stream.readRF1String()
                rEffect.xyz = stream.readEVec3Float()
                rEffect.rotMatrix = stream.readRotMat()
                rEffect.scriptName = stream.readRF1String()
                rEffect.unknown = stream.readInt8()
                rEffects.push(rEffect)
            }
            return <RF1RoomEffects>{type: sectionType, roomEffects: rEffects}
        case RFLSections.CLIMBING_REGIONS:
            const cRegionCount = stream.readUint32()
            let cRegions : RF1ClimbingRegion[] = []
            for (let i = 0; i < cRegionCount; i++) {
                const cRegion = <RF1ClimbingRegion>{}
                cRegion.uid = stream.readInt32()
                cRegion.className = stream.readRF1String()
                cRegion.xyz = stream.readEVec3Float()
                cRegion.rotMatrix = stream.readRotMat()
                cRegion.scriptName = stream.readRF1String()
                cRegion.unknown = stream.readInt8()
                cRegion.type = stream.readUint32()
                cRegion.dimensions = stream.readEVec3Float()
                cRegions.push(cRegion)
            }
            return <RF1ClimbingRegions>{type: sectionType, climbingRegions: cRegions}
        case RFLSections.BOLT_EMITTERS:
            const bEmitterCount = stream.readUint32()
            let bEmitters : RF1BoltEmitter[] = []
            for (let i = 0; i < bEmitterCount; i++) {
                const bEmitter = <RF1BoltEmitter>{}
                bEmitter.uid = stream.readInt32()
                bEmitter.className = stream.readRF1String()
                bEmitter.xyz = stream.readEVec3Float()
                bEmitter.rotMatrix = stream.readRotMat()
                bEmitter.scriptName = stream.readRF1String()
                bEmitter.unknown = stream.readInt8()
                bEmitter.targetUid = stream.readUint32() //TODO: verify if this is signed/unsigned
                bEmitter.sourceControlDistance = stream.readFloat32()
                bEmitter.targetControlDistance = stream.readFloat32()
                bEmitter.thickness = stream.readFloat32()
                bEmitter.jitter = stream.readFloat32()
                bEmitter.numberSegments = stream.readInt32()
                bEmitter.spawnDelay = stream.readFloat32()
                bEmitter.spawnDelayVariance = stream.readFloat32()
                bEmitter.decay = stream.readFloat32()
                bEmitter.decayVariance = stream.readFloat32()
                bEmitter.boltColor = stream.readEVec4Uint8()
                bEmitter.boltBitmap = stream.readRF1String()
                bEmitter.flags = stream.readUint8()
                bEmitter.unknown2 = stream.readSlice(3)
                bEmitter.initiallyOn = stream.readUint8()
                bEmitters.push(bEmitter)
            }
            return <RF1BoltEmitters>{type: sectionType, boltEmitters: bEmitters}
        case RFLSections.TARGETS:
            const targetCount = stream.readUint32()
            let targets : RF1Target[] = []
            for (let i = 0; i < targetCount; i++) {
                const target = <RF1Target>{}
                target.uid = stream.readInt32()
                target.className = stream.readRF1String()
                target.xyz = stream.readEVec3Float()
                target.rotMatrix = stream.readRotMat()
                target.scriptName = stream.readRF1String()
                target.unknown = stream.readInt8()
                targets.push(target)
            }
            return <RF1Targets>{type: sectionType, targets: targets}
        case RFLSections.DECALS:
            const decalCount = stream.readUint32()
            let decals : RF1Decal[] = []
            for (let i = 0; i < decalCount; i++) {
                const decal = <RF1Decal>{}
                decal.uid = stream.readInt32()
                decal.className = stream.readRF1String()
                decal.xyz = stream.readEVec3Float()
                decal.rotMatrix = stream.readRotMat()
                decal.scriptName = stream.readRF1String()
                decal.unknown = stream.readInt8()
                decal.dimensions = stream.readEVec3Float()
                decal.decalBitmap = stream.readRF1String()
                decal.alpha = stream.readUint8()
                decal.unknown2 = stream.readSlice(3)
                decal.selfIlluminated = stream.readInt8()
                decal.tiling = stream.readInt8()
                decal.unknown3 = stream.readSlice(3)
                decal.scale = stream.readFloat32()
                decals.push(decal)
            }
            return <RF1Decals>{type: sectionType, decals: decals}
        case RFLSections.PUSH_REGIONS:
            const pRegionCount = stream.readUint32()
            let pRegions : RF1PushRegion[] = []
            for (let i = 0; i < pRegionCount; i++) {
                const pRegion = <RF1PushRegion>{}
                pRegion.uid = stream.readInt32()
                pRegion.className = stream.readRF1String()
                pRegion.xyz = stream.readEVec3Float()
                pRegion.rotMatrix = stream.readRotMat()
                pRegion.scriptName = stream.readRF1String()
                pRegion.unknown = stream.readInt8()
                pRegion.type = stream.readInt32()
                if (pRegion.type === RF1PushRegionTypes.SPHERE)
                    pRegion.radius = stream.readFloat32()
                else
                    pRegion.dimensions = stream.readEVec3Float()
                pRegion.strength = stream.readFloat32()
                pRegion.flags = stream.readInt8()
                pRegion.unknown2 = stream.readInt8()
                pRegion.turbulence = stream.readUint16()
                pRegions.push(pRegion)
            }
            return <RF1PushRegions>{type: sectionType, pushRegions: pRegions}
        case RFLSections.LIGHTMAPS:
            const lightmapCount = stream.readUint32()
            let lightmaps : RF1Lightmap[] = []
            for (let i = 0; i < lightmapCount; i++) {
                const lightmap = <RF1Lightmap>{}
                lightmap.width = stream.readUint32()
                lightmap.height = stream.readUint32()
                lightmap.bitmap = stream.readSlice(lightmap.width * lightmap.height * 3) //24bpp bitmap
                lightmaps.push(lightmap)
            }
            return <RF1Lightmaps>{type: sectionType, lightmaps: lightmaps}
        case RFLSections.MOVERS:
            return <RF1Movers>{type: sectionType, movers: parseRF1Brushes(stream, version)}
        case RFLSections.MOVING_GROUPS:
            return <RF1MovingGroups>{type: sectionType, movingGroups: parseRFLGroups(stream)}
        case RFLSections.CUTSCENES:
            const cutsceneCount = stream.readUint32()
            let cutscenes : RF1Cutscene[] = []
            for (let i = 0; i < cutsceneCount; i++) {
                const cutscene = <RF1Cutscene>{}
                cutscene.uid = stream.readInt32()
                cutscene.hidePlayer = stream.readInt8()
                cutscene.fov = stream.readFloat32()
                cutscene.numberShots = stream.readInt32()
                cutscene.shots = []
                for (let ii = 0; ii < cutscene.numberShots; ii++) {
                    const cShot = <RF1CutsceneShot>{}
                    cShot.cameraUid = stream.readInt32()
                    cShot.preWait = stream.readFloat32()
                    cShot.pathTime = stream.readFloat32()
                    cShot.postWait = stream.readFloat32()
                    cShot.lookAtUid = stream.readInt32()
                    cShot.triggerUid = stream.readInt32()
                    cShot.pathName = stream.readRF1String()
                    cutscene.shots.push(cShot)
                }
                cutscenes.push(cutscene)
            }
            return <RF1Cutscenes>{type: sectionType, cutscenes: cutscenes}
        case RFLSections.CUTSCENE_PATH_NODES:
            const cpnCount = stream.readUint32()
            let cpns : RF1CutscenePathNode[] = []
            for (let i = 0; i < cpnCount; i++) {
                const cpn = <RF1CutscenePathNode>{}
                cpn.uid = stream.readInt32()
                cpn.className = stream.readRF1String()
                cpn.xyz = stream.readEVec3Float()
                cpn.rotMatrix = stream.readRotMat()
                cpn.scriptName = stream.readRF1String()
                cpn.unknown = stream.readInt8()
                cpns.push(cpn)
            }
            return <RF1CutscenePathNodes>{type: sectionType, cutscenePathNodes: cpns}
        case RFLSections.CUTSCENE_PATHS:
            const cpathCount = stream.readUint32()
            let cpaths : RF1CutscenePath[] = []
            for (let i = 0; i < cpathCount; i++) {
                const cpath = <RF1CutscenePath>{}
                cpath.pathName = stream.readRF1String()
                cpath.pathNodeCount = stream.readUint32()
                cpath.pathNodes = []
                for (let ii = 0; ii < cpath.pathNodeCount; ii++)
                    cpath.pathNodes.push(stream.readInt32())
                cpaths.push(cpath)
            }
            return <RF1CutscenePaths>{type: sectionType, cutscenePaths: cpaths}
        case RFLSections.TGA_UNKNOWN:
            const tgaCount = stream.readUint32()
            let TGAs : string[] = []
            for (let i = 0; i < tgaCount; i++)
                TGAs.push(stream.readRF1String())
                return <RF1TGAUnknowns>{type: sectionType, TGAs: TGAs}
        case RFLSections.VCM_UNKNOWN: //v
        case RFLSections.MVF_UNKNOWN: //v
        case RFLSections.V3D_UNKNOWN: //v
        case RFLSections.VFX_UNKNOWN: //<
            const vmvvUnkCount = stream.readUint32()
            const vmvvUnk = <RF1vmvvUnk>{}
            vmvvUnk.strings = []
            vmvvUnk.unknowns = []
            for (let i = 0; i < vmvvUnkCount; i++)
                vmvvUnk.strings.push(stream.readRF1String())
            for (let i = 0; i < vmvvUnkCount; i++)
                vmvvUnk.unknowns.push(stream.readUint32())
            return <RF1vmvvUnks>{type: sectionType, vmmvUnk: vmvvUnk}
        case RFLSections.EAX_EFFECTS:
            const eEffectCount = stream.readUint32()
            let eEffects : RF1eaxEffect[] = []
            for (let i = 0; i < eEffectCount; i++) {
                const eEffect = <RF1eaxEffect>{}
                eEffect.effectName = stream.readRF1String()
                eEffect.uid = stream.readInt32()
                eEffect.className = stream.readRF1String()
                eEffect.xyz = stream.readEVec3Float()
                eEffect.rotMatrix = stream.readRotMat()
                eEffect.scriptName = stream.readRF1String()
                eEffect.unknown = stream.readInt8()
                eEffects.push(eEffect)
            }
            return <RF1eaxEffects>{type: sectionType, eaxEffects: eEffects}
        case RFLSections.WAYPOINT_LISTS:
            const wlCount = stream.readUint32()
            let wLists : RF1WaypointList[] = []
            for (let i = 0; i < wlCount; i++) {
                const wList = <RF1WaypointList>{}
                wList.name = stream.readRF1String()
                wList.waypointCount = stream.readUint32()
                wList.navPointIndex = []
                for (let ii = 0; ii < wList.waypointCount; ii++)
                    wList.navPointIndex.push(stream.readUint32()) //TODO: figure out if this is supposed to be npoint uid rather than uint32
                wLists.push(wList)
            }
            return <RF1WaypointLists>{type: sectionType, waypointLists: wLists}
        case RFLSections.NAV_POINT_LISTS:
            const navPointCount = stream.readUint32()
            const nPLists = <RF1NavPointList>{}

            nPLists.navPoints = []
            for (let i = 0; i < navPointCount; i++) {
                const nPoint = <RF1NavPoint>{}
                nPoint.uid = stream.readInt32()
                nPoint.unknown = stream.readInt8()
                nPoint.height = stream.readFloat32()
                nPoint.xyz = stream.readEVec3Float()
                nPoint.radius = stream.readFloat32()
                nPoint.unknown2 = stream.readSlice(4)
                nPoint.directional = stream.readInt8()
                if (nPoint.directional === 1)
                    nPoint.rotMatrix = stream.readRotMat()
                nPoint.cover = stream.readInt8()
                nPoint.hide = stream.readInt8()
                nPoint.crouch = stream.readInt8()
                nPoint.pauseTime = stream.readFloat32()
                nPoint.linkCount = stream.readUint32()
                nPoint.links = []
                for (let ii = 0; ii < nPoint.linkCount; ii++)
                    nPoint.links.push(stream.readInt32())
                nPLists.navPoints.push(nPoint)
            }

            nPLists.navPointConnections = []
            for (let i = 0; i < navPointCount; i++) {
                const nPConnCount = stream.readUint8()
                const npConn: number[] = []
                for (let ii = 0; ii < nPConnCount; ii++)
                    npConn.push(stream.readUint32()) //TODO: figure out if this is supposed to be npoint signed uid rather than uint32
                nPLists.navPointConnections.push(npConn)
            }

            return <RF1NavPointLists>{type: sectionType, navPointLists: nPLists}
        case RFLSections.ENTITIES:
            const entityCount = stream.readUint32()
            let entities : RF1Entity[] = []
            for (let i = 0; i < entityCount; i++) {
                const entity = <RF1Entity>{}
                entity.uid = stream.readInt32()
                entity.className = stream.readRF1String()
                entity.xyz = stream.readEVec3Float()
                entity.rotMatrix = stream.readRotMat()
                entity.scriptName = stream.readRF1String()
                entity.unknown = stream.readUint8()
                entity.cooperation = stream.readUint32()
                entity.friendliness = stream.readUint32()
                entity.teamID = stream.readUint32()
                entity.waypointList = stream.readRF1String()
                entity.waypointMethod = stream.readRF1String()
                entity.unknown2 = stream.readInt8()
                entity.boarded = stream.readInt8()
                entity.readyToFireState = stream.readInt8()
                entity.onlyAttackPlayer = stream.readInt8()
                entity.weaponIsHolstered = stream.readInt8()
                entity.deaf = stream.readInt8()
                entity.sweepMinAngle = stream.readFloat32()
                entity.sweepMaxAngle = stream.readFloat32()
                entity.ignoreTerrainWhenFiring = stream.readInt8()
                entity.unknown3 = stream.readInt8()
                entity.startCrouched = stream.readInt8()
                entity.life = stream.readFloat32()
                entity.armor = stream.readFloat32()
                entity.fov = stream.readInt32()
                entity.defaultPrimaryWeapon = stream.readRF1String()
                entity.defaultSecondaryWeapon = stream.readRF1String()
                entity.itemDrop = stream.readRF1String()
                entity.stateAnim = stream.readRF1String()
                entity.corpsePose = stream.readRF1String()
                entity.skin = stream.readRF1String()
                entity.deathAnim = stream.readRF1String()
                entity.aiMode = stream.readUint8()
                entity.aiAttackStyle = stream.readUint8()
                entity.unknown4 = stream.readSlice(4)
                entity.turretUID = stream.readInt32()
                entity.alertCameraUID = stream.readInt32()
                entity.alarmEventUID = stream.readInt32()
                entity.run = stream.readInt8()
                entity.startHidden = stream.readInt8()
                entity.wearHelmet = stream.readInt8()
                entity.endGameIfKilled = stream.readInt8()
                entity.coverFromWeapon = stream.readInt8()
                entity.questionUnarmedPlayer = stream.readInt8()
                entity.dontHum = stream.readInt8()
                entity.noShadow = stream.readInt8()
                entity.alwaysSimulate = stream.readInt8()
                entity.perfectAim = stream.readInt8()
                entity.permanentCorpse = stream.readInt8()
                entity.neverFly = stream.readInt8()
                entity.neverLeave = stream.readInt8()
                entity.noPersonaMessages = stream.readInt8()
                entity.fadeCorpseImmediately = stream.readInt8()
                entity.neverCollideWithPlayer = stream.readInt8()
                entity.useCustomAttackRange = stream.readInt8()
                if (entity.useCustomAttackRange === 1)
                    entity.customAttackRange = stream.readFloat32()
                entity.leftHandHolding = stream.readRF1String()
                entity.rightHandHolding = stream.readRF1String()
                entities.push(entity)
            }
            return <RF1Entities>{type: sectionType, entities: entities}
        case RFLSections.ITEMS:
            const itemCount = stream.readUint32()
            let items : RF1Item[] = []
            for (let i = 0; i < itemCount; i++) {
                const item = <RF1Item>{}
                item.uid = stream.readInt32()
                item.className = stream.readRF1String()
                item.xyz = stream.readEVec3Float()
                item.rotMatrix = stream.readRotMat()
                item.scriptName = stream.readRF1String()
                item.unknown = stream.readInt8()
                item.count = stream.readInt32()
                item.respawnTime = stream.readInt32()
                item.teamID = stream.readInt32()
                items.push(item)
            }
            return <RF1Items>{type: sectionType, items: items}
        case RFLSections.CLUTTERS:
            const clutterCount = stream.readUint32()
            let clutters : RF1Clutter[] = []
            for (let i = 0; i < clutterCount; i++) {
                const clutter = <RF1Clutter>{}
                clutter.uid = stream.readInt32()
                clutter.className = stream.readRF1String()
                clutter.xyz = stream.readEVec3Float()
                clutter.rotMatrix = stream.readRotMat()
                clutter.scriptName = stream.readRF1String()
                clutter.unknown = stream.readSlice(5)
                clutter.skin = stream.readRF1String()
                clutter.linkCount = stream.readUint32()
                clutter.links = []
                for (let ii = 0; ii < clutter.linkCount; ii++)
                    clutter.links.push(stream.readInt32())
                clutters.push(clutter)
            }
            return <RF1Clutters>{type: sectionType, clutters: clutters}
        case RFLSections.TRIGGERS:
            const triggerCount = stream.readUint32()
            let triggers : RF1Trigger[] = []
            for (let i = 0; i < triggerCount; i++) {
                const trigger = <RF1Trigger>{}
                trigger.uid = stream.readInt32()
                trigger.scriptName = stream.readRF1String()
                trigger.unknown = stream.readUint8()
                trigger.isBox = stream.readInt8()
                trigger.unknown2 = stream.readSlice(3)
                trigger.resetsAfter = stream.readFloat32()
                trigger.resetsCount = stream.readInt16()
                trigger.unknown3 = stream.readUint16()
                trigger.useKeyIsRequiredToActivateTrigger = stream.readInt8()
                trigger.keyName = stream.readRF1String()
                trigger.playerWeaponActivatesTrigger = stream.readInt8()
                trigger.activatedBy = stream.readInt8()
                trigger.isNpc = stream.readInt8()
                trigger.isAuto = stream.readInt8()
                trigger.playerInVehicle = stream.readInt8()
                trigger.xyz = stream.readEVec3Float()
                if (trigger.isBox === 0)
                    trigger.sphereRadius = stream.readFloat32()
                else {
                    trigger.rotationMatrix = stream.readRotMat()
                    trigger.boxDimensions = stream.readEVec3Float()
                    trigger.oneWay = stream.readInt8()
                }
                trigger.airlockRoomUID = stream.readInt32()
                trigger.attachedToUID = stream.readInt32()
                trigger.useClutterUID = stream.readInt32()
                trigger.disabled = stream.readInt8()
                trigger.buttonActiveTime = stream.readFloat32()
                trigger.insideTime = stream.readFloat32()
                trigger.team = stream.readUint32()
                trigger.linkCount = stream.readUint32()
                trigger.links = []
                for (let ii = 0; ii < trigger.linkCount; ii++)
                    trigger.links.push(stream.readInt32())
                triggers.push(trigger)
            }
            return <RF1Triggers>{type: sectionType, triggers: triggers}
        case RFLSections.PLAYER_START:
            const pStartXYZ = stream.readEVec3Float()
            const pStartRM = stream.readRotMat()
            return <RF1PlayerStart>{type: sectionType, xyz: pStartXYZ, rotMatrix: pStartRM}
        case RFLSections.LEVEL_INFO:
            const levelInfo = <RFLLevelInfo>{}
            levelInfo.type = sectionType
            levelInfo.unknown = stream.readUint32()
            levelInfo.levelName = stream.readRF1String()
            levelInfo.author = stream.readRF1String()
            levelInfo.date = stream.readRF1String()
            levelInfo.unknown2 = stream.readInt8()
            levelInfo.multiplayerLevel = stream.readInt8()
            levelInfo.viewports = [] // TL -> TR -> BL -> BR
            for (let i = 0; i < 4; i++) {
                const vport = <RFLViewport>{}
                vport.type = stream.readUint32()
                if (vport.type !== RFLViewportTypes.FREE_LOOK)
                    vport.zoom = stream.readFloat32()
                vport.xyz = stream.readEVec3Float()
                vport.rotMatrix = stream.readRotMat()
                levelInfo.viewports.push(vport)
            }
            return levelInfo
        case RFLSections.BRUSHES:
            return <RF1Brushes>{type: sectionType, brushes: parseRF1Brushes(stream, version)}
        case RFLSections.GROUPS:
            return <RF1Groups>{type: sectionType, groups: parseRFLGroups(stream)}
        case RFLSections.EDITOR_ONLY_LIGHTS:
            return <RF1EditorOnlyLights>{type: sectionType, lights: parseRFLLights(stream)}
        default:
            console.warn("parseRFLSection default case")
            return <RF1Bytes>{type: sectionType, data: stream.readSlice(sectionSize)}
            
    }
}

export function parse(buffer: ArrayBufferSlice): RF1BaseInterface[] {
    const stream = new DataStream(buffer);

    //parse rfl header {
        assert(stream.readUint32() === 0xD4BADA55)
        let version = stream.readUint32() //0xC8: RF 1.0 and 1.2, stock maps 0xB4
        let timestamp = stream.readUint32() //when map was last saved
        let playerStartOffset = stream.readUint32() //offset to player_start section
        let levelInfoOffset = stream.readUint32() //offset to level_info section
        let sectionsCount = stream.readUint32()
        let unknownSize = stream.readUint32() //sections data size - 8 (do not include headers)
        let levelName = stream.readRF1String() //this is duplicated in levelInfo section
        let modName = stream.readRF1String()
    // }

    console.log("enter")
    let parsedSections : RF1BaseInterface[] = []
    while (stream.offs < stream.buffer.byteLength) {
        let sectionType : RFLSections = stream.readUint32()
        let sectionSize = stream.readUint32()
        let sectionEndO = stream.offs + sectionSize

        let parsedSection = parseRFLSection(stream, sectionType, sectionSize, version)
        parsedSections.push(parsedSection)
        console.log(RFLSections[parsedSection.type])
        //console.log(parsedSection)

        if (stream.offs < sectionEndO)
            stream.offs = sectionEndO
    }
    console.log("exit")
    stream.offs-- //debug
    console.log(`last byte: ${stream.readUint8()} (offs: ${stream.offs}/${stream.buffer.byteLength})`) //debug

    return parsedSections
}
