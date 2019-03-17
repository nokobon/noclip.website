
precision mediump float;

// Expected to be constant across the entire scene.
layout(row_major, std140) uniform ub_SceneParams {
    Mat4x4 u_Projection;
};

layout(row_major, std140) uniform ub_MeshFragParams {
    Mat4x3 u_BoneMatrix[1];
    float u_AnimFrame;
};

//uniform sampler2D u_Texture[1];
uniform sampler2D u_Texture[1];
//uniform sampler2D u_Lightmap[8];
uniform highp sampler2DArray u_lightmapArr;
uniform highp sampler2DArray u_AnimArr;

varying vec3 v_Norm;
varying vec2 v_TexCoord;
varying vec3 v_LightmapTexCoord;
//varying float v_Time;

#ifdef VERT
layout(location = 0) in vec3 a_Position;
layout(location = 1) in vec3 a_Normal;
layout(location = 2) in vec2 a_TexCoord;
layout(location = 3) in vec3 a_LightmapTexCoord;

void main() {
    //gl_Position = Mul(u_Projection, Mul(_Mat4x4(u_BoneMatrix[0]), vec4(a_Position, 1.0)));
    gl_Position = Mul(u_Projection, Mul(_Mat4x4(u_BoneMatrix[0]), vec4(a_Position, 1.0)));
    //gl_Position = vec4(a_Position, 1.0);
    //gl_Position =  Mul(u_Projection, vec4(a_Position, 1.0));
    v_Norm = a_Normal;
    v_TexCoord = a_TexCoord;
    v_LightmapTexCoord = a_LightmapTexCoord;
    //v_Time = u_Time;
}
#endif

#ifdef FRAG
void main() {
    vec4 t_Color = vec4(1.0);
    //t_Color.rgb *= cos(v_Time);

#ifdef USE_TEXTURE
    #ifdef TEX_STAT
        t_Color *= texture2D(u_Texture[0], v_TexCoord);
    #endif
    #ifdef TEX_ANIM
        //t_Color *= texture(u_AnimArr, vec3(v_TexCoord, mod(u_Time, 30.0)));
        t_Color *= texture(u_AnimArr, vec3(v_TexCoord, u_AnimFrame));
        //t_Color.rgb *= vec3(u_BoneMatrix[0][0]);
    #endif
#endif

#ifdef USE_LIGHTMAP
    t_Color.rgb *= texture(u_lightmapArr, v_LightmapTexCoord).rgb;
#endif

    //if (t_Color.a < 0.0125)
    //    discard;

    gl_FragColor = t_Color;
}
#endif
