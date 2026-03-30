/**
 * FactionCarouselView - Swipeable faction selection carousel
 * Extracted from menu.ts as part of Phase 1 refactoring
 */

import { FactionCarouselOption } from './types';
import * as Constants from '../constants';

export class FactionCarouselView {
    private static readonly ITEM_SPACING_PX = 210;
    private static readonly BASE_SIZE_PX = 224;
    private static readonly EDGE_GAP_PX = 24;
    private static readonly NAME_FONT_SIZE_RATIO = 0.14;
    private static readonly DESC_FONT_SIZE_RATIO = 0.08;
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
    private isPendingGestureClassification: boolean = false;
    private isHorizontalDragActive: boolean = false;
    private touchStartXScreen: number = 0;
    private touchStartYScreen: number = 0;

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
                this.beginTouchInteraction(event.touches[0].clientX, event.touches[0].clientY);
            }
        }, { passive: false });

        this.container.addEventListener('touchmove', (event: TouchEvent) => {
            if (event.touches.length !== 1) {
                return;
            }

            const touch = event.touches[0];
            if (!this.isHorizontalDragActive) {
                const deltaX = touch.clientX - this.touchStartXScreen;
                const deltaY = touch.clientY - this.touchStartYScreen;
                const absDeltaX = Math.abs(deltaX);
                const absDeltaY = Math.abs(deltaY);

                if (absDeltaY > absDeltaX && absDeltaY > Constants.CLICK_DRAG_THRESHOLD) {
                    this.resetTouchInteraction();
                    return;
                }

                if (absDeltaX > absDeltaY && absDeltaX > Constants.CLICK_DRAG_THRESHOLD) {
                    this.startDrag(this.touchStartXScreen);
                    this.isPendingGestureClassification = false;
                    this.isHorizontalDragActive = true;
                } else {
                    return;
                }
            }

            if (this.isDragging) {
                this.updateDrag(touch.clientX);
                event.preventDefault();
            }
        }, { passive: false });

        this.container.addEventListener('touchend', (event: TouchEvent) => {
            const touch = event.changedTouches[0];
            if (!touch) {
                this.resetTouchInteraction();
                return;
            }

            if (this.isHorizontalDragActive && this.isDragging) {
                this.endDrag(touch.clientX);
                event.preventDefault();
            } else if (this.isPendingGestureClassification) {
                this.handleClick(touch.clientX);
            }
            this.resetTouchInteraction();
        }, { passive: false });

        this.container.addEventListener('touchcancel', () => {
            this.resetTouchInteraction();
        });
    }

    private beginTouchInteraction(clientX: number, clientY: number): void {
        this.isPendingGestureClassification = true;
        this.isHorizontalDragActive = false;
        this.touchStartXScreen = clientX;
        this.touchStartYScreen = clientY;
    }

    private resetTouchInteraction(): void {
        this.isPendingGestureClassification = false;
        this.isHorizontalDragActive = false;
        if (this.isDragging) {
            this.stopDrag();
        }
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

        this.stopDrag();

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

    private stopDrag(): void {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
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

    private getScaleForDistance(distance: number): number {
        if (distance <= 0) return 1.0;
        if (distance <= 1) return 1.0 + (0.72 - 1.0) * distance;
        if (distance <= 2) return 0.72 + (0.5 - 0.72) * (distance - 1);
        return Math.max(0.3, 0.5 - (distance - 2) * 0.2);
    }

    private getOpacityForDistance(distance: number): number {
        if (distance <= 0) return 1.0;
        if (distance <= 1) return 1.0 + (0.85 - 1.0) * distance;
        if (distance <= 2) return 0.85 + (0.55 - 0.85) * (distance - 1);
        return Math.max(0.3, 0.55 - (distance - 2) * 0.25);
    }

    private render(): void {
        this.container.innerHTML = '';

        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const layoutScale = this.getLayoutScale();
        const itemSpacingPx = this.getItemSpacingPx();
        const baseSizePx = FactionCarouselView.BASE_SIZE_PX * layoutScale;
        const edgeGapPx = FactionCarouselView.EDGE_GAP_PX * layoutScale;

        // Compute effective center as continuous float from scroll offset
        const effectiveCenter = -this.scrollOffset / itemSpacingPx;

        // Compute continuous scale, opacity, and size for each item
        const itemSizes: number[] = [];
        const itemScales: number[] = [];
        const itemOpacities: number[] = [];
        for (let i = 0; i < this.options.length; i++) {
            const distance = Math.abs(i - effectiveCenter);
            itemScales[i] = this.getScaleForDistance(distance);
            itemOpacities[i] = this.getOpacityForDistance(distance);
            itemSizes[i] = baseSizePx * itemScales[i];
        }

        // Compute relative positions using accumulated half-widths + fixed edge gaps
        const relPositions: number[] = [0];
        for (let i = 1; i < this.options.length; i++) {
            relPositions[i] = relPositions[i - 1] + itemSizes[i - 1] / 2 + edgeGapPx + itemSizes[i] / 2;
        }

        // Compute relative position of the effective center point via interpolation
        const floorIdx = Math.max(0, Math.min(this.options.length - 1, Math.floor(effectiveCenter)));
        const ceilIdx = Math.max(0, Math.min(this.options.length - 1, Math.ceil(effectiveCenter)));
        const frac = effectiveCenter - Math.floor(effectiveCenter);
        const centerRelPos = floorIdx === ceilIdx
            ? relPositions[floorIdx]
            : relPositions[floorIdx] * (1 - frac) + relPositions[ceilIdx] * frac;

        for (let i = 0; i < this.options.length; i++) {
            const option = this.options[i];
            const distance = Math.abs(i - effectiveCenter);
            const isSelected = distance < 0.5;
            const scale = itemScales[i];
            const opacity = itemOpacities[i];
            const sizePx = itemSizes[i];
            const x = centerX + (relPositions[i] - centerRelPos);

            const optionElement = document.createElement('div');
            optionElement.style.position = 'absolute';
            optionElement.style.left = `${x - sizePx / 2}px`;
            optionElement.style.top = `${centerY - sizePx / 2}px`;
            optionElement.style.width = `${sizePx}px`;
            optionElement.style.height = `${sizePx}px`;
            optionElement.style.backgroundColor = isSelected ? 'rgba(12, 14, 22, 0.98)' : 'rgba(12, 14, 22, 0.85)';
            optionElement.style.border = isSelected ? `2px solid ${option.color}` : '2px solid rgba(255, 255, 255, 0.2)';
            optionElement.style.borderRadius = '10px';
            optionElement.style.opacity = opacity.toString();
            optionElement.style.display = 'flex';
            optionElement.style.flexDirection = 'column';
            optionElement.style.justifyContent = 'center';
            optionElement.style.alignItems = 'center';
            optionElement.style.pointerEvents = 'none';
            optionElement.style.color = '#FFFFFF';
            optionElement.style.fontWeight = 'bold';
            optionElement.style.textAlign = 'center';
            optionElement.style.padding = `${24 * layoutScale}px`;
            optionElement.style.boxSizing = 'border-box';
            optionElement.style.zIndex = (100 - Math.round(distance)).toString();
            optionElement.style.overflow = 'hidden';
            optionElement.dataset.particleBox = 'true';
            optionElement.dataset.particleColor = isSelected ? option.color : '#66B3FF';

            const nameElement = document.createElement('div');
            nameElement.textContent = option.name.toUpperCase();
            nameElement.style.fontSize = `${sizePx * FactionCarouselView.NAME_FONT_SIZE_RATIO}px`;
            nameElement.style.marginBottom = isSelected ? '14px' : '0';
            nameElement.style.color = isSelected ? '#FFFFFF' : '#E0F2FF';
            nameElement.style.fontWeight = 'bold';
            nameElement.dataset.particleText = 'true';
            nameElement.dataset.particleColor = isSelected ? '#FFFFFF' : '#E0F2FF';
            optionElement.appendChild(nameElement);

            if (isSelected) {
                const descElement = document.createElement('div');
                descElement.textContent = option.description;
                descElement.style.fontSize = `${sizePx * FactionCarouselView.DESC_FONT_SIZE_RATIO}px`;
                descElement.style.color = '#D0D0D0';
                descElement.style.lineHeight = '1.4';
                descElement.style.fontWeight = 'bold';
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
