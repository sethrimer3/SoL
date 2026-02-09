/**
 * Map Selection Screen Renderer
 * Displays available maps for player selection
 */

import { MapConfig } from '../types';

export interface MapSelectionScreenParams {
    availableMaps: MapConfig[];
    selectedMap: MapConfig;
    onMapSelect: (map: MapConfig) => void;
    onBack: () => void;
    createButton: (text: string, onClick: () => void, color?: string) => HTMLButtonElement;
    menuParticleLayer: { requestTargetRefresh: (element: HTMLElement) => void } | null;
}

export function renderMapSelectionScreen(
    container: HTMLElement,
    params: MapSelectionScreenParams
): void {
    const { availableMaps, selectedMap, onMapSelect, onBack, createButton, menuParticleLayer } = params;
    const screenWidth = window.innerWidth;
    const isCompactLayout = screenWidth < 600;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Select Map';
    title.style.fontSize = isCompactLayout ? '32px' : '48px';
    title.style.marginBottom = isCompactLayout ? '20px' : '30px';
    title.style.color = '#FFD700';
    title.style.textAlign = 'center';
    title.style.maxWidth = '100%';
    title.style.fontWeight = '300';
    title.dataset.particleText = 'true';
    title.dataset.particleColor = '#FFD700';
    container.appendChild(title);

    // Map grid
    const mapGrid = document.createElement('div');
    mapGrid.style.display = 'grid';
    mapGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${isCompactLayout ? 220 : 300}px, 1fr))`;
    mapGrid.style.gap = '20px';
    mapGrid.style.maxWidth = '900px';
    mapGrid.style.padding = '20px';
    mapGrid.style.marginBottom = '30px';

    for (const map of availableMaps) {
        const mapCard = document.createElement('div');
        mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        mapCard.style.border = '2px solid transparent';
        mapCard.style.borderRadius = '10px';
        mapCard.style.padding = '20px';
        mapCard.style.cursor = 'pointer';
        mapCard.style.transition = 'all 0.3s';
        mapCard.dataset.particleBox = 'true';
        mapCard.dataset.particleColor = map.id === selectedMap.id ? '#FFD700' : '#66B3FF';

        mapCard.addEventListener('mouseenter', () => {
            if (map.id !== selectedMap.id) {
                mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                mapCard.style.transform = 'scale(1.02)';
            }
        });

        mapCard.addEventListener('mouseleave', () => {
            mapCard.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            mapCard.style.transform = 'scale(1)';
        });

        mapCard.addEventListener('click', () => {
            onMapSelect(map);
        });

        // Map name
        const mapName = document.createElement('h3');
        mapName.textContent = map.name;
        mapName.style.fontSize = '28px';
        mapName.style.marginBottom = '10px';
        mapName.style.color = map.id === selectedMap.id ? '#FFD700' : '#FFFFFF';
        mapName.style.fontWeight = '300';
        mapName.dataset.particleText = 'true';
        mapName.dataset.particleColor = map.id === selectedMap.id ? '#FFF2B3' : '#E0F2FF';
        mapCard.appendChild(mapName);

        // Map description
        const mapDesc = document.createElement('p');
        mapDesc.textContent = map.description;
        mapDesc.style.fontSize = '24px';
        mapDesc.style.lineHeight = '1.5';
        mapDesc.style.marginBottom = '15px';
        mapDesc.style.color = '#CCCCCC';
        mapDesc.style.fontWeight = '300';
        mapDesc.dataset.particleText = 'true';
        mapDesc.dataset.particleColor = '#CCCCCC';
        mapCard.appendChild(mapDesc);

        // Map stats
        const mapStats = document.createElement('div');
        mapStats.style.fontSize = '24px';
        mapStats.style.color = '#888888';
        mapStats.innerHTML = `
            <div>⭐ Suns: ${map.numSuns}</div>
            <div>🌑 Asteroids: ${map.numAsteroids}</div>
            <div>📏 Size: ${map.mapSize}px</div>
        `;
        mapCard.appendChild(mapStats);

        mapGrid.appendChild(mapCard);
    }

    container.appendChild(mapGrid);

    // Back button
    const backButton = createButton('BACK', onBack, '#666666');
    container.appendChild(backButton);
    menuParticleLayer?.requestTargetRefresh(container);
}
