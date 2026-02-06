/**
 * Graphics options configuration for the renderer
 */

export type GraphicVariant = 'svg' | 'png' | 'stub';
export type GraphicKey =
    | 'centralSun'
    | 'stellarForge'
    | 'forgeFlameHot'
    | 'forgeFlameCold'
    | 'solarMirror'
    | 'starling'
    | 'heroMarine'
    | 'heroGrave'
    | 'heroDagger'
    | 'heroBeam'
    | 'heroMortar'
    | 'heroRay'
    | 'heroNova'
    | 'heroInfluenceBall'
    | 'heroTurretDeployer'
    | 'heroDriller'
    | 'heroPreist'
    | 'heroTank';

export type GraphicOption = {
    key: GraphicKey;
    label: string;
    svgPath?: string;
    pngPath?: string;
};

export const graphicsOptions: GraphicOption[] = [
    {
        key: 'centralSun',
        label: 'Central Sun',
        svgPath: 'ASSETS/sprites/environment/centralSun.svg',
        pngPath: 'ASSETS/sprites/environment/centralSun.png'
    },
    {
        key: 'stellarForge',
        label: 'Stellar Forge Base',
        svgPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantBaseType1.svg',
        pngPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantBaseType1.png'
    },
    {
        key: 'forgeFlameHot',
        label: 'Forge Flame (Hot)',
        pngPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantForgeFlame.png'
    },
    {
        key: 'forgeFlameCold',
        label: 'Forge Flame (Cold)',
        pngPath: 'ASSETS/sprites/RADIANT/stellarForgeBases/radiantForgeFlameCold.png'
    },
    {
        key: 'solarMirror',
        label: 'Solar Mirror',
        svgPath: 'ASSETS/sprites/RADIANT/solarMirrors/radiantSolarMirror.svg',
        pngPath: 'ASSETS/sprites/RADIANT/solarMirrors/radiantSolarMirror.png'
    },
    {
        key: 'starling',
        label: 'Starling',
        svgPath: 'ASSETS/sprites/RADIANT/starlings/starlingLevel (1).svg',
        pngPath: 'ASSETS/sprites/RADIANT/starlings/starlingLevel (1).png'
    },
    {
        key: 'heroMarine',
        label: 'Hero: Marine',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Marine.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Marine.png'
    },
    {
        key: 'heroGrave',
        label: 'Hero: Grave',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Grave.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Grave.png'
    },
    {
        key: 'heroRay',
        label: 'Hero: Ray',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Ray.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Ray.png'
    },
    {
        key: 'heroNova',
        label: 'Hero: Nova',
        svgPath: 'ASSETS/sprites/VELARIS/heroUnits/Nova.svg',
        pngPath: 'ASSETS/sprites/VELARIS/heroUnits/Nova.png'
    },
    {
        key: 'heroInfluenceBall',
        label: 'Hero: Influence Ball',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Uniter.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Uniter.png'
    },
    {
        key: 'heroTurretDeployer',
        label: 'Hero: Turret Deployer',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Engineer.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Engineer.png'
    },
    {
        key: 'heroDriller',
        label: 'Hero: Driller',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Drill.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Drill.png'
    },
    {
        key: 'heroDagger',
        label: 'Hero: Dagger',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Dagger.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Dagger.png'
    },
    {
        key: 'heroBeam',
        label: 'Hero: Beam',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Beam.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Beam.png'
    },
    {
        key: 'heroPreist',
        label: 'Hero: Preist',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Preist.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Preist.png'
    },
    {
        key: 'heroTank',
        label: 'Hero: Tank',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Tank.svg',
        pngPath: 'ASSETS/sprites/RADIANT/heroUnits/Tank.png'
    }
];
