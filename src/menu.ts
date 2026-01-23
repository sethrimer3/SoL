/**
 * Main Menu for SoL game
 */

export class MainMenu {
    private menuElement: HTMLElement;
    private onStartCallback: (() => void) | null = null;

    constructor() {
        this.menuElement = this.createMenuElement();
        document.body.appendChild(this.menuElement);
    }

    private createMenuElement(): HTMLElement {
        const menu = document.createElement('div');
        menu.id = 'mainMenu';
        menu.style.position = 'fixed';
        menu.style.top = '0';
        menu.style.left = '0';
        menu.style.width = '100%';
        menu.style.height = '100%';
        menu.style.backgroundColor = 'rgba(0, 0, 10, 0.95)';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.justifyContent = 'center';
        menu.style.alignItems = 'center';
        menu.style.zIndex = '1000';
        menu.style.fontFamily = 'Arial, sans-serif';
        menu.style.color = '#FFFFFF';

        // Title
        const title = document.createElement('h1');
        title.textContent = 'SoL';
        title.style.fontSize = '72px';
        title.style.marginBottom = '10px';
        title.style.color = '#FFD700';
        title.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
        menu.appendChild(title);

        // Subtitle
        const subtitle = document.createElement('h2');
        subtitle.textContent = 'Speed of Light RTS';
        subtitle.style.fontSize = '24px';
        subtitle.style.marginBottom = '50px';
        subtitle.style.color = '#AAAAAA';
        menu.appendChild(subtitle);

        // Description
        const description = document.createElement('p');
        description.textContent = 'Battle for supremacy around stars using light as a resource';
        description.style.fontSize = '16px';
        description.style.marginBottom = '40px';
        description.style.maxWidth = '500px';
        description.style.textAlign = 'center';
        description.style.lineHeight = '1.5';
        menu.appendChild(description);

        // Start button
        const startButton = document.createElement('button');
        startButton.textContent = 'START GAME';
        startButton.style.fontSize = '24px';
        startButton.style.padding = '15px 40px';
        startButton.style.backgroundColor = '#FFD700';
        startButton.style.color = '#000000';
        startButton.style.border = 'none';
        startButton.style.borderRadius = '5px';
        startButton.style.cursor = 'pointer';
        startButton.style.fontWeight = 'bold';
        startButton.style.transition = 'all 0.3s';
        
        startButton.addEventListener('mouseenter', () => {
            startButton.style.backgroundColor = '#FFA500';
            startButton.style.transform = 'scale(1.05)';
        });
        
        startButton.addEventListener('mouseleave', () => {
            startButton.style.backgroundColor = '#FFD700';
            startButton.style.transform = 'scale(1)';
        });
        
        startButton.addEventListener('click', () => {
            this.hide();
            if (this.onStartCallback) {
                this.onStartCallback();
            }
        });
        
        menu.appendChild(startButton);

        // Features list
        const features = document.createElement('div');
        features.style.marginTop = '60px';
        features.style.fontSize = '14px';
        features.style.color = '#888888';
        features.innerHTML = `
            <div style="text-align: center;">
                <div>✨ Ray-traced lighting and shadows</div>
                <div style="margin-top: 5px;">🌌 Asteroid obstacles with dynamic polygons</div>
                <div style="margin-top: 5px;">⭐ Solar mirrors and resource collection</div>
                <div style="margin-top: 5px;">🎮 Touch and mouse controls</div>
            </div>
        `;
        menu.appendChild(features);

        return menu;
    }

    /**
     * Set callback for when start button is clicked
     */
    onStart(callback: () => void): void {
        this.onStartCallback = callback;
    }

    /**
     * Hide the menu
     */
    hide(): void {
        this.menuElement.style.display = 'none';
    }

    /**
     * Show the menu
     */
    show(): void {
        this.menuElement.style.display = 'flex';
    }

    /**
     * Remove the menu from DOM
     */
    destroy(): void {
        if (this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
    }
}
