/**
 * UI Helper Functions for Menu System
 * Reusable UI component creators for settings and menu screens
 */

import * as Constants from '../constants';

/**
 * Create a labeled setting section with a control element
 */
export function createSettingSection(label: string, control: HTMLElement): HTMLElement {
    const section = document.createElement('div');
    section.style.marginBottom = '30px';
    section.style.display = 'flex';
    section.style.justifyContent = 'space-between';
    section.style.alignItems = 'center';

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.fontSize = '24px';
    labelElement.style.color = '#FFFFFF';
    labelElement.style.fontWeight = '300';
    labelElement.dataset.particleText = 'true';
    labelElement.dataset.particleColor = '#FFFFFF';

    section.appendChild(labelElement);
    section.appendChild(control);

    return section;
}

/**
 * Create a dropdown select element
 */
export function createSelect(options: string[], currentValue: string, onChange: (value: string) => void): HTMLSelectElement {
    const select = document.createElement('select');
    select.style.fontSize = '24px';
    select.style.padding = '8px 15px';
    select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    select.style.color = '#FFFFFF';
    select.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    select.style.borderRadius = '5px';
    select.style.cursor = 'pointer';
    select.style.fontFamily = 'inherit';
    select.style.fontWeight = '300';

    for (const option of options) {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
        optionElement.selected = option === currentValue;
        optionElement.style.backgroundColor = Constants.UI_BACKGROUND_COLOR;
        select.appendChild(optionElement);
    }

    select.addEventListener('change', () => {
        onChange(select.value);
    });

    return select;
}

/**
 * Create a toggle switch element
 */
export function createToggle(currentValue: boolean, onChange: (value: boolean) => void): HTMLElement {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.gap = '10px';

    const toggle = document.createElement('div');
    toggle.style.width = '60px';
    toggle.style.height = '30px';
    toggle.style.backgroundColor = currentValue ? '#00FF88' : '#666666';
    toggle.style.borderRadius = '15px';
    toggle.style.position = 'relative';
    toggle.style.cursor = 'pointer';
    toggle.style.transition = 'all 0.3s';

    const knob = document.createElement('div');
    knob.style.width = '26px';
    knob.style.height = '26px';
    knob.style.backgroundColor = '#FFFFFF';
    knob.style.borderRadius = '50%';
    knob.style.position = 'absolute';
    knob.style.top = '2px';
    knob.style.left = currentValue ? '32px' : '2px';
    knob.style.transition = 'all 0.3s';

    toggle.appendChild(knob);

    toggle.addEventListener('click', () => {
        const newValue = !currentValue;
        currentValue = newValue;
        toggle.style.backgroundColor = newValue ? '#00FF88' : '#666666';
        knob.style.left = newValue ? '32px' : '2px';
        onChange(newValue);
    });

    toggleContainer.appendChild(toggle);

    return toggleContainer;
}

/**
 * Create a color picker element
 */
export function createColorPicker(currentValue: string, onChange: (value: string) => void): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';

    // Color preview box
    const preview = document.createElement('div');
    preview.style.width = '40px';
    preview.style.height = '40px';
    preview.style.backgroundColor = currentValue;
    preview.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    preview.style.borderRadius = '5px';
    preview.style.cursor = 'pointer';

    // Hidden color input
    const input = document.createElement('input');
    input.type = 'color';
    input.value = currentValue;
    input.style.opacity = '0';
    input.style.width = '0';
    input.style.height = '0';
    input.style.position = 'absolute';

    input.addEventListener('change', () => {
        preview.style.backgroundColor = input.value;
        onChange(input.value);
    });

    preview.addEventListener('click', () => {
        input.click();
    });

    container.appendChild(preview);
    container.appendChild(input);

    return container;
}

/**
 * Create a text input element
 */
export function createTextInput(currentValue: string, onChange: (value: string) => void, placeholder: string = ''): HTMLElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.placeholder = placeholder;
    input.style.fontSize = '20px';
    input.style.padding = '8px 15px';
    input.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    input.style.color = '#FFFFFF';
    input.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    input.style.borderRadius = '5px';
    input.style.fontFamily = 'inherit';
    input.style.fontWeight = '300';
    input.style.minWidth = '200px';
    input.maxLength = 20; // DOM property for input validation
    input.style.outline = 'none';

    // Update on blur to avoid excessive onChange triggers
    input.addEventListener('blur', () => {
        onChange(input.value);
    });

    // Also update on Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    return input;
}
