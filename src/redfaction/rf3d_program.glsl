precision mediump float;

// Expected to be constant across the entire scene.
layout(row_major, std140) uniform ub_SceneParams {
    Mat4x4 u_Projection;
};

layout(row_major, std140) uniform ub_MeshFragParams {
    Mat4x3 u_BoneMatrix[1];
    float u_AnimFrame;
};

uniform sampler2D u_Texture[1];
uniform highp sampler2DArray u_AnimArr;


varying vec3 v_Norm;
varying vec2 v_TexCoord;

#ifdef VERT
layout(location = 0) in vec3 a_Position;
layout(location = 1) in vec3 a_Normal;
layout(location = 2) in vec2 a_TexCoord;

void main() {
    gl_Position = Mul(u_Projection, Mul(_Mat4x4(u_BoneMatrix[0]), vec4(a_Position, 1.0)));
    v_Norm = a_Normal;
    v_TexCoord = a_TexCoord;
}
#endif

#ifdef FRAG
void main() {
    vec4 t_Color = vec4(1.0);

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

    gl_FragColor = t_Color;
}
#endif
