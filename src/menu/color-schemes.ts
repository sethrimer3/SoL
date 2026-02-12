/**
 * Color schemes for menu visual effects
 */

export interface ColorScheme {
    id: string;
    name: string;
    background: string;
    asteroidColors: {
        fillStart: string;
        fillEnd: string;
        strokeStart: string;
        strokeEnd: string;
    };
    spaceDustPalette: {
        neutral: string[];
        accent: string[];
    };
    sunCore: {
        inner: string;
        mid: string;
        outer: string;
    };
    sunGlow: {
        outerGlow1: string;
        outerGlow2: string;
        outerGlow3: string;
        outerGlow4: string;
    };
    sunLightRays: {
        nearCenter: string;
        mid: string;
        edge: string;
    };
    lensFlareHalo: string;
}

export const COLOR_SCHEMES: { [key: string]: ColorScheme } = {
    'SpaceBlack': {
        id: 'SpaceBlack',
        name: 'Space Black',
        background: '#0A0F1A',
        asteroidColors: {
            fillStart: '#FFC46B',
            fillEnd: '#3B2A1A',
            strokeStart: '#FFD08A',
            strokeEnd: '#5A3F26'
        },
        spaceDustPalette: {
            neutral: ['#0B1020', '#10192E', '#1C2A4A', '#243459'],
            accent: ['#FFCF66', '#FF9A2A', '#FF6A00']
        },
        sunCore: {
            inner: 'rgba(255, 248, 230, 1)',     // #FFF8E6 clipped white-hot core
            mid: 'rgba(255, 242, 176, 1)',       // #FFF2B0 inner glow white-yellow
            outer: 'rgba(255, 214, 90, 0.95)'    // #FFD65A bright plasma gold
        },
        sunGlow: {
            outerGlow1: 'rgba(255, 185, 94, 0.8)',  // #FFB95E soft golden glow
            outerGlow2: 'rgba(255, 158, 58, 0.5)',  // #FF9E3A radiant amber
            outerGlow3: 'rgba(255, 122, 26, 0.28)', // #FF7A1A burning orange
            outerGlow4: 'rgba(230, 92, 0, 0)'       // #E65C00 warm fade
        },
        sunLightRays: {
            nearCenter: 'rgba(255, 241, 184, 0.3)',   // #FFF1B8 beam core
            mid: 'rgba(255, 179, 71, 0.5)',           // #FFB347 mid beam
            edge: 'rgba(255, 140, 40, 0)'             // beam edge fade
        },
        lensFlareHalo: 'rgba(255, 140, 0, 0.12)'      // warm cinematic grade overlay
    },
    'ColdIce': {
        id: 'ColdIce',
        name: 'Cold Ice',
        background: '#0B1426',
        asteroidColors: {
            fillStart: '#4A3B6E',
            fillEnd: '#7B63A6',
            strokeStart: '#6A52A0',
            strokeEnd: '#B39DE6'
        },
        spaceDustPalette: {
            neutral: ['#6D717B', '#7C808A', '#8A8D97', '#9A9EB0'],
            accent: ['#6C5A91', '#7B66A8', '#8B75C3', '#9A82D6']
        },
        sunCore: {
            inner: 'rgba(230, 245, 255, 1)',     // soft icy white
            mid: 'rgba(190, 220, 255, 0.95)',    // pale blue
            outer: 'rgba(150, 200, 255, 0.85)'   // light blue edge
        },
        sunGlow: {
            outerGlow1: 'rgba(200, 230, 255, 0.75)',
            outerGlow2: 'rgba(160, 210, 255, 0.45)',
            outerGlow3: 'rgba(120, 190, 255, 0.25)',
            outerGlow4: 'rgba(80, 170, 255, 0)'
        },
        sunLightRays: {
            nearCenter: 'rgba(220, 240, 255, 0.2)',
            mid: 'rgba(170, 215, 255, 0.45)',
            edge: 'rgba(130, 190, 255, 0.7)'
        },
        lensFlareHalo: 'rgba(210, 235, 255, 0.18)'
    },
    'DeepSpace': {
        id: 'DeepSpace',
        name: 'Deep Space',
        background: '#0A0A1E',
        asteroidColors: {
            fillStart: '#4A4A7E',
            fillEnd: '#2E2E5A',
            strokeStart: '#6A6A9E',
            strokeEnd: '#4A4A7A'
        },
        spaceDustPalette: {
            neutral: ['#3A3A5E', '#4A4A6E', '#5A5A7E', '#6A6A8E'],
            accent: ['#5A4A8F', '#6A5A9F', '#7A6AAF', '#8A7ABF']
        },
        sunCore: {
            inner: 'rgba(220, 200, 255, 1)',     // soft purple-white
            mid: 'rgba(180, 150, 230, 0.95)',    // lavender
            outer: 'rgba(140, 100, 200, 0.85)'   // purple edge
        },
        sunGlow: {
            outerGlow1: 'rgba(170, 140, 230, 0.75)',
            outerGlow2: 'rgba(140, 110, 200, 0.45)',
            outerGlow3: 'rgba(110, 80, 170, 0.25)',
            outerGlow4: 'rgba(80, 50, 140, 0)'
        },
        sunLightRays: {
            nearCenter: 'rgba(200, 180, 240, 0.2)',
            mid: 'rgba(160, 130, 210, 0.45)',
            edge: 'rgba(120, 90, 180, 0.7)'
        },
        lensFlareHalo: 'rgba(190, 170, 230, 0.18)'
    },
    'RedGiant': {
        id: 'RedGiant',
        name: 'Red Giant',
        background: '#1A0A0A',
        asteroidColors: {
            fillStart: '#8A5A5A',
            fillEnd: '#5A3030',
            strokeStart: '#AA7A7A',
            strokeEnd: '#7A4A4A'
        },
        spaceDustPalette: {
            neutral: ['#6A4A4A', '#7A5A5A', '#8A6A6A', '#9A7A7A'],
            accent: ['#8F5A4A', '#9F6A5A', '#AF7A6A', '#BF8A7A']
        },
        sunCore: {
            inner: 'rgba(255, 240, 200, 1)',     // warm white-yellow
            mid: 'rgba(255, 160, 80, 0.95)',     // bright orange
            outer: 'rgba(255, 100, 60, 0.85)'    // red-orange edge
        },
        sunGlow: {
            outerGlow1: 'rgba(255, 140, 80, 0.75)',
            outerGlow2: 'rgba(240, 100, 60, 0.45)',
            outerGlow3: 'rgba(220, 60, 40, 0.25)',
            outerGlow4: 'rgba(200, 40, 20, 0)'
        },
        sunLightRays: {
            nearCenter: 'rgba(255, 200, 150, 0.2)',
            mid: 'rgba(255, 140, 90, 0.45)',
            edge: 'rgba(240, 100, 60, 0.7)'
        },
        lensFlareHalo: 'rgba(255, 180, 120, 0.18)'
    },
    'Nebula': {
        id: 'Nebula',
        name: 'Nebula',
        background: '#150A1A',
        asteroidColors: {
            fillStart: '#7A4A7A',
            fillEnd: '#5A2A5A',
            strokeStart: '#9A6A9A',
            strokeEnd: '#7A4A7A'
        },
        spaceDustPalette: {
            neutral: ['#6A4A6A', '#7A5A7A', '#8A6A8A', '#9A7A9A'],
            accent: ['#8F4A7A', '#9F5A8A', '#AF6A9A', '#BF7AAA']
        },
        sunCore: {
            inner: 'rgba(255, 220, 255, 1)',     // soft pink-white
            mid: 'rgba(240, 150, 220, 0.95)',    // bright pink
            outer: 'rgba(200, 100, 180, 0.85)'   // magenta edge
        },
        sunGlow: {
            outerGlow1: 'rgba(230, 140, 210, 0.75)',
            outerGlow2: 'rgba(200, 100, 180, 0.45)',
            outerGlow3: 'rgba(170, 70, 150, 0.25)',
            outerGlow4: 'rgba(140, 50, 120, 0)'
        },
        sunLightRays: {
            nearCenter: 'rgba(240, 180, 230, 0.2)',
            mid: 'rgba(210, 130, 190, 0.45)',
            edge: 'rgba(180, 90, 160, 0.7)'
        },
        lensFlareHalo: 'rgba(230, 160, 210, 0.18)'
    },
    'GreenAurora': {
        id: 'GreenAurora',
        name: 'Green Aurora',
        background: '#0A1A14',
        asteroidColors: {
            fillStart: '#4A7A5A',
            fillEnd: '#2A5A3A',
            strokeStart: '#6A9A7A',
            strokeEnd: '#4A7A5A'
        },
        spaceDustPalette: {
            neutral: ['#4A6A5A', '#5A7A6A', '#6A8A7A', '#7A9A8A'],
            accent: ['#4A8F6A', '#5A9F7A', '#6AAF8A', '#7ABF9A']
        },
        sunCore: {
            inner: 'rgba(220, 255, 230, 1)',     // soft mint-white
            mid: 'rgba(160, 240, 180, 0.95)',    // bright mint green
            outer: 'rgba(100, 200, 140, 0.85)'   // teal-green edge
        },
        sunGlow: {
            outerGlow1: 'rgba(140, 230, 170, 0.75)',
            outerGlow2: 'rgba(100, 200, 140, 0.45)',
            outerGlow3: 'rgba(70, 170, 110, 0.25)',
            outerGlow4: 'rgba(50, 140, 80, 0)'
        },
        sunLightRays: {
            nearCenter: 'rgba(180, 240, 210, 0.2)',
            mid: 'rgba(130, 210, 170, 0.45)',
            edge: 'rgba(90, 180, 130, 0.7)'
        },
        lensFlareHalo: 'rgba(160, 230, 190, 0.18)'
    }
};
