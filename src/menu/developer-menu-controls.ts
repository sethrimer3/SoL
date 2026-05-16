export interface DeveloperMenuElementVisibility {
    isBackgroundLayerVisible: boolean;
    isAtmosphereLayerVisible: boolean;
    isParticleLayerVisible: boolean;
    isBuildLabelVisible: boolean;
    isTestLevelButtonVisible: boolean;
    isLadButtonVisible: boolean;
    isMainMenuContentVisible: boolean;
}

export function createBuildNumberLabel(buildNumber: number): HTMLDivElement {
    const label = document.createElement('div');
    label.textContent = `BUILD ${buildNumber}`;
    label.style.position = 'absolute';
    label.style.top = '16px';
    label.style.left = '16px';
    label.style.padding = '6px 10px';
    label.style.borderRadius = '6px';
    label.style.border = '1px solid rgba(255, 255, 255, 0.4)';
    label.style.backgroundColor = 'rgba(10, 10, 10, 0.6)';
    label.style.color = '#FFFFFF';
    label.style.fontFamily = '"Doto", Arial, sans-serif';
    label.style.fontWeight = '500';
    label.style.fontSize = '12px';
    label.style.letterSpacing = '0.18em';
    label.style.textTransform = 'uppercase';
    label.style.zIndex = '2';
    label.style.pointerEvents = 'none';
    return label;
}

interface CreateQuickLaunchButtonOptions {
    text: string;
    rightPx: number;
    onClick: () => void;
}

export function createQuickLaunchButton(options: CreateQuickLaunchButtonOptions): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = options.text;
    button.type = 'button';
    button.style.position = 'absolute';
    button.style.top = '20px';
    button.style.right = `${options.rightPx}px`;
    button.style.padding = '10px 16px';
    button.style.borderRadius = '6px';
    button.style.border = '1px solid rgba(255, 255, 255, 0.6)';
    button.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
    button.style.color = '#FFFFFF';
    button.style.fontFamily = 'Arial, sans-serif';
    button.style.fontWeight = '500';
    button.style.fontSize = '14px';
    button.style.letterSpacing = '0.08em';
    button.style.cursor = 'pointer';
    button.style.zIndex = '2';
    button.style.transition = 'background-color 0.2s ease, border-color 0.2s ease';

    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(60, 60, 60, 0.85)';
        button.style.borderColor = '#FFD700';
    });

    button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'rgba(20, 20, 20, 0.7)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.6)';
    });

    button.addEventListener('click', options.onClick);
    return button;
}

interface CreateDeveloperMenuControlsPanelOptions {
    visibility: DeveloperMenuElementVisibility;
    onVisibilityChange: () => void;
}

export function createDeveloperMenuControlsPanel(options: CreateDeveloperMenuControlsPanelOptions): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.position = 'absolute';
    panel.style.top = '64px';
    panel.style.right = '20px';
    panel.style.width = '220px';
    panel.style.padding = '10px';
    panel.style.borderRadius = '8px';
    panel.style.border = '1px solid rgba(255, 255, 255, 0.5)';
    panel.style.backgroundColor = 'rgba(12, 12, 12, 0.82)';
    panel.style.zIndex = '3';
    panel.style.display = 'none';

    const title = document.createElement('div');
    title.textContent = 'DEV MENU ELEMENTS';
    title.style.color = '#FFD700';
    title.style.fontFamily = 'Arial, sans-serif';
    title.style.fontSize = '11px';
    title.style.fontWeight = '600';
    title.style.letterSpacing = '0.1em';
    title.style.marginBottom = '8px';
    panel.appendChild(title);

    const toggleConfigs: Array<{ labelText: string; key: keyof DeveloperMenuElementVisibility }> = [
        { labelText: 'Background Layer', key: 'isBackgroundLayerVisible' },
        { labelText: 'Atmosphere Layer', key: 'isAtmosphereLayerVisible' },
        { labelText: 'Particle Layer', key: 'isParticleLayerVisible' },
        { labelText: 'Build Label', key: 'isBuildLabelVisible' },
        { labelText: 'Test Button', key: 'isTestLevelButtonVisible' },
        { labelText: 'LaD Button', key: 'isLadButtonVisible' },
        { labelText: 'Main Content', key: 'isMainMenuContentVisible' },
    ];

    for (const config of toggleConfigs) {
        panel.appendChild(createDeveloperToggleControl(config.labelText, options.visibility[config.key], (isEnabled) => {
            options.visibility[config.key] = isEnabled;
            options.onVisibilityChange();
        }));
    }

    return panel;
}

function createDeveloperToggleControl(
    labelText: string,
    isChecked: boolean,
    onChange: (isEnabled: boolean) => void
): HTMLDivElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.gap = '8px';

    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.fontSize = '12px';
    label.style.color = '#FFFFFF';
    label.style.fontFamily = 'Arial, sans-serif';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.style.cursor = 'pointer';
    checkbox.addEventListener('change', () => {
        onChange(checkbox.checked);
    });

    row.appendChild(label);
    row.appendChild(checkbox);
    return row;
}
