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
    | 'heroTank'
    | 'heroSpotlight'
    | 'heroMothership'
    | 'heroSly'
    | 'heroChrono'
    | 'heroShadow'
    | 'heroOcclude'
    | 'heroVelarisHero'
    | 'heroSplendor'
    | 'heroDash'
    | 'heroBlink'
    | 'heroShroud'
    | 'heroAurumHero'
    | 'heroRadiant';

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
    },
    {
        key: 'heroMortar',
        label: 'Hero: Mortar',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Mortar.svg'
    },
    {
        key: 'heroSpotlight',
        label: 'Hero: Spotlight',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Spotlight.svg'
    },
    {
        key: 'heroMothership',
        label: 'Hero: Mothership',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Mothership.svg'
    },
    {
        key: 'heroRadiant',
        label: 'Hero: Radiant',
        svgPath: 'ASSETS/sprites/RADIANT/heroUnits/Radiant.svg'
    },
    {
        key: 'heroSly',
        label: 'Hero: Sly',
        svgPath: 'ASSETS/sprites/VELARIS/heroUnits/Sly.svg'
    },
    {
        key: 'heroChrono',
        label: 'Hero: Chrono',
        svgPath: 'ASSETS/sprites/VELARIS/heroUnits/Chrono.svg'
    },
    {
        key: 'heroShadow',
        label: 'Hero: Shadow',
        svgPath: 'ASSETS/sprites/VELARIS/heroUnits/Shadow.svg'
    },
    {
        key: 'heroOcclude',
        label: 'Hero: Occlude',
        svgPath: 'ASSETS/sprites/VELARIS/heroUnits/Occlude.svg'
    },
    {
        key: 'heroVelarisHero',
        label: 'Hero: Velaris',
        svgPath: 'ASSETS/sprites/VELARIS/heroUnits/VelarisHero.svg'
    },
    {
        key: 'heroSplendor',
        label: 'Hero: Splendor',
        svgPath: 'ASSETS/sprites/AURUM/heroUnits/Splendor.svg'
    },
    {
        key: 'heroDash',
        label: 'Hero: Dash',
        svgPath: 'ASSETS/sprites/AURUM/heroUnits/Dash.svg'
    },
    {
        key: 'heroBlink',
        label: 'Hero: Blink',
        svgPath: 'ASSETS/sprites/AURUM/heroUnits/Blink.svg'
    },
    {
        key: 'heroShroud',
        label: 'Hero: Shroud',
        svgPath: 'ASSETS/sprites/AURUM/heroUnits/Shroud.svg'
    },
    {
        key: 'heroAurumHero',
        label: 'Hero: Aurum',
        svgPath: 'ASSETS/sprites/AURUM/heroUnits/AurumHero.svg'
    }
];
