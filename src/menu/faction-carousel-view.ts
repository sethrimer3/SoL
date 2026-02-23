/**
 * FactionCarouselView - Swipeable faction selection carousel
 * Extracted from menu.ts as part of Phase 1 refactoring
 */

import { FactionCarouselOption } from './types';
import * as Constants from '../constants';

export class FactionCarouselView {
    private static readonly ITEM_SPACING_PX = 210;
    private static readonly BASE_SIZE_PX = 224;
    private static readonly TEXT_SCALE = 2.4;
    private static readonly VELOCITY_MULTIPLIER = 0.1;
    private static readonly VELOCITY_FACTOR = 0.001;
    private static readonly SMOOTH_INTERPOLATION_FACTOR = 0.15;
    private static readonly VELOCITY_DECAY_FACTOR = 0.9;
    private static readonly SWIPE_THRESHOLD_PX = 50;

    private container: HTMLElement;
    private options: FactionCarouselOption[];
    private currentIndex: number;
    private targetIndex: number;
    private scrollOffset: number = 0;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartOffset: number = 0;
    private lastDragDeltaX: number = 0;
    private velocity: number = 0;
    private hasDragged: boolean = false;
    private isCompactLayout: boolean = false;
    private resizeHandler: (() => void) | null = null;
    private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
    private onSelectionChangeCallback: ((option: FactionCarouselOption) => void) | null = null;
    private onRenderCallback: (() => void) | null = null;
    private animationFrameId: number | null = null;
    private isAnimationActive: boolean = false;

    constructor(container: HTMLElement, options: FactionCarouselOption[], initialIndex: number) {
        this.container = container;
        this.options = options;
        this.currentIndex = Math.max(0, Math.min(options.length - 1, initialIndex));
        this.targetIndex = this.currentIndex;
        this.setupContainer();
        this.setupEventHandlers();
        this.scrollOffset = -this.currentIndex * this.getItemSpacingPx();
        this.startAnimation();
    }

    private setupContainer(): void {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.updateLayoutMetrics();
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'grab';
        this.container.style.userSelect = 'none';
        this.container.style.touchAction = 'pan-y';
    }

    private setupEventHandlers(): void {
        this.resizeHandler = () => {
            this.updateLayoutMetrics();
        };
        window.addEventListener('resize', this.resizeHandler);

        this.keydownHandler = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'arrowleft' || key === 'a') {
                this.moveSelection(-1);
                event.preventDefault();
            }
            if (key === 'arrowright' || key === 'd') {
                this.moveSelection(1);
                event.preventDefault();
            }
        };
        window.addEventListener('keydown', this.keydownHandler);

        this.container.addEventListener('mousedown', (event: MouseEvent) => {
            this.startDrag(event.clientX);
            event.preventDefault();
        });

        this.container.addEventListener('mousemove', (event: MouseEvent) => {
            if (this.isDragging) {
                this.updateDrag(event.clientX);
                event.preventDefault();
            }
        });

        this.container.addEventListener('mouseup', (event: MouseEvent) => {
            this.endDrag(event.clientX);
            event.preventDefault();
        });

        this.container.addEventListener('mouseleave', () => {
            if (this.isDragging) {
                this.endDrag(this.dragStartX);
            }
        });

        this.container.addEventListener('touchstart', (event: TouchEvent) => {
            if (event.touches.length === 1) {
                this.startDrag(event.touches[0].clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchmove', (event: TouchEvent) => {
            if (this.isDragging && event.touches.length === 1) {
                this.updateDrag(event.touches[0].clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchend', (event: TouchEvent) => {
            if (this.isDragging) {
                const touch = event.changedTouches[0];
                this.endDrag(touch.clientX);
                event.preventDefault();
            }
        }, { passive: false });
    }

    private startDrag(x: number): void {
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartOffset = this.scrollOffset;
        this.velocity = 0;
        this.hasDragged = false;
        this.lastDragDeltaX = 0;
        this.container.style.cursor = 'grabbing';
        this.startAnimation();
    }

    private updateDrag(x: number): void {
        if (!this.isDragging) return;

        const deltaX = x - this.dragStartX;
        this.lastDragDeltaX = deltaX;
        this.scrollOffset = this.dragStartOffset + deltaX;
        this.velocity = deltaX * FactionCarouselView.VELOCITY_MULTIPLIER;

        if (Math.abs(deltaX) > Constants.CLICK_DRAG_THRESHOLD) {
            this.hasDragged = true;
        }
        this.startAnimation();
    }

    private endDrag(x: number): void {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.container.style.cursor = 'grab';

        if (!this.hasDragged) {
            this.handleClick(x);
            return;
        }

        const itemWidthPx = this.getItemSpacingPx();
        const deltaX = this.lastDragDeltaX;
        if (Math.abs(deltaX) >= FactionCarouselView.SWIPE_THRESHOLD_PX) {
            const direction = deltaX < 0 ? 1 : -1;
            this.setCurrentIndex(this.currentIndex + direction);
            return;
        }

        const targetIndexFloat = -this.scrollOffset / itemWidthPx;
        const targetIndex = Math.round(targetIndexFloat + this.velocity * FactionCarouselView.VELOCITY_FACTOR);
        this.setCurrentIndex(targetIndex);
    }

    private handleClick(x: number): void {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const relativeX = x - rect.left;
        const offsetFromCenter = relativeX - centerX;
        const clickedOffset = this.currentIndex + Math.round(offsetFromCenter / this.getItemSpacingPx());
        this.setCurrentIndex(clickedOffset);
    }

    private moveSelection(direction: number): void {
        this.setCurrentIndex(this.currentIndex + direction);
    }

    private setCurrentIndex(nextIndex: number): void {
        const clampedIndex = Math.max(0, Math.min(this.options.length - 1, nextIndex));
        if (clampedIndex === this.currentIndex) {
            this.targetIndex = clampedIndex;
            return;
        }

        this.targetIndex = clampedIndex;
        this.currentIndex = clampedIndex;
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.options[this.currentIndex]);
        }
        this.startAnimation();
    }

    private startAnimation(): void {
        if (this.isAnimationActive) {
            return;
        }
        this.isAnimationActive = true;
        const animate = () => {
            if (!this.isAnimationActive) {
                return;
            }
            const shouldContinue = this.update();
            this.render();
            if (!shouldContinue) {
                this.isAnimationActive = false;
                this.animationFrameId = null;
                return;
            }
            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    public pauseAnimation(): void {
        if (!this.isAnimationActive) {
            return;
        }
        this.isAnimationActive = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public resumeAnimation(): void {
        this.startAnimation();
    }

    private updateLayoutMetrics(): void {
        this.isCompactLayout = window.innerWidth < 600;
        const targetHeight = this.isCompactLayout ? '300px' : '380px';
        if (this.container.style.height !== targetHeight) {
            this.container.style.height = targetHeight;
        }
    }

    private getLayoutScale(): number {
        return this.isCompactLayout ? 0.6 : 0.9;
    }

    private getItemSpacingPx(): number {
        return FactionCarouselView.ITEM_SPACING_PX * this.getLayoutScale();
    }

    private update(): boolean {
        this.updateLayoutMetrics();
        const targetScrollOffset = -this.currentIndex * this.getItemSpacingPx();
        const diff = targetScrollOffset - this.scrollOffset;
        this.scrollOffset += diff * FactionCarouselView.SMOOTH_INTERPOLATION_FACTOR;

        if (!this.isDragging && Math.abs(this.velocity) > 0.1) {
            this.velocity *= FactionCarouselView.VELOCITY_DECAY_FACTOR;
            this.scrollOffset += this.velocity;
        } else {
            this.velocity = 0;
        }
        const hasSettled = !this.isDragging
            && Math.abs(this.velocity) <= 0.1
            && Math.abs(diff) < 0.5;
        if (hasSettled) {
            this.scrollOffset = targetScrollOffset;
        }
        return !hasSettled;
    }

    private render(): void {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const layoutScale = this.getLayoutScale();
        const itemSpacingPx = this.getItemSpacingPx();
        const baseSizePx = FactionCarouselView.BASE_SIZE_PX * layoutScale;
        const textScale = FactionCarouselView.TEXT_SCALE * layoutScale;

        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const offsetFromCenter = i - this.currentIndex;
            const distance = Math.abs(offsetFromCenter);
            const x = centerX + this.scrollOffset + i * itemSpacingPx;

            let scale = 1.0;
            let opacity = 1.0;
            if (distance === 0) {
                scale = 1.0;
                opacity = 1.0;
            } else if (distance === 1) {
                scale = 0.72;
                opacity = 0.85;
            } else if (distance === 2) {
                scale = 0.5;
                opacity = 0.55;
            } else {
                scale = Math.max(0.3, 1.0 - distance * 0.25);
                opacity = Math.max(0.3, 1.0 - distance * 0.25);
            }

            const sizePx = baseSizePx * scale;
            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - sizePx / 2}px`;
            optionElement.style.top = `${centerY - sizePx / 2}px`;
            optionElement.style.width = `${sizePx}px`;
            optionElement.style.height = `${sizePx}px`;
            optionElement.style.backgroundColor = distance === 0 ? 'rgba(12, 14, 22, 0.98)' : 'rgba(12, 14, 22, 0.85)';
            optionElement.style.border = distance === 0 ? `2px solid ${option.color}` : '2px solid rgba(255, 255, 255, 0.2)';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none';
            optionElement.style.color = '#FFFFFF';
            optionElement.style.fontWeight = '300';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = `${24 * layoutScale}px`;
            optionElement.style.boxSizing = 'border-box';
            optionElement.style.zIndex = (100 - distance).toString();
            optionElement.style.overflow = 'hidden';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = distance === 0 ? option.color : '#66B3FF';

            const nameElement = document.createElement('div');
            nameElement.textContent = option.name.toUpperCase();
            nameElement.style.fontSize = `${Math.max(16, 20 * scale) * textScale}px`;
            nameElement.style.marginBottom = distance === 0 ? '14px' : '0';
            nameElement.style.color = distance === 0 ? '#FFFFFF' : '#E0F2FF';
            nameElement.style.fontWeight = '300';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = distance === 0 ? '#FFFFFF' : '#E0F2FF';
            optionElement.appendChild(nameElement);

            if (distance === 0) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${Math.max(10, 12 * scale) * textScale}px`;
                descElement.style.color = '#D0D0D0';
                descElement.style.lineHeight = '1.4';
                descElement.style.fontWeight = '300';
                descElement.dataset.particleText = 'true';
                descElement.dataset.particleColor = '#D0D0D0';
                optionElement.appendChild(descElement);
            }

            this.container.appendChild(optionElement);
        }

        if (this.onRenderCallback) {
            this.onRenderCallback();
        }
    }

    public onSelectionChange(callback: (option: FactionCarouselOption) => void): void {
        this.onSelectionChangeCallback = callback;
    }

    public onRender(callback: () => void): void {
        this.onRenderCallback = callback;
    }

    public destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
    }
}

/**
 * Carousel menu view - displays menu options in a horizontal carousel
 */
