const themeColors = {
    background: {
        light: '#FFF9F0',
        dark: '#191720'
    }
};

function hexToRgb(hex) {
    const value = hex.slice(1);
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}

function relativeLuminance({ r, g, b }) {
    const channels = [r, g, b].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
    const luminances = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
    return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

function blendColor(color, destination, amount) {
    const channels = ['r', 'g', 'b'].map((channel) =>
        Math.round(color[channel] + (destination[channel] - color[channel]) * amount)
    );
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function createCoordinatedColors(hex) {
    const { r, g, b } = hexToRgb(hex);
    const maximum = Math.max(r, g, b) / 255;
    const minimum = Math.min(r, g, b) / 255;
    const difference = maximum - minimum;
    let hue = 0;

    if (difference) {
        if (maximum === r / 255) hue = ((g - b) / 255 / difference) % 6;
        else if (maximum === g / 255) hue = (b - r) / 255 / difference + 2;
        else hue = (r - g) / 255 / difference + 4;
    }

    hue = (hue * 60 + 360) % 360;
    const lightness = (maximum + minimum) / 2;
    const saturation = difference ? difference / (1 - Math.abs(2 * lightness - 1)) : 0;

    function hslToHex(offset) {
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const section = ((hue + offset) % 360) / 60;
        const secondary = chroma * (1 - Math.abs(section % 2 - 1));
        const match = lightness - chroma / 2;
        const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
            : section < 2 ? [secondary, chroma, 0]
                : section < 3 ? [0, chroma, secondary]
                    : section < 4 ? [0, secondary, chroma]
                        : section < 5 ? [secondary, 0, chroma]
                            : [chroma, 0, secondary];
        return `#${[red, green, blue].map((channel) =>
            Math.round((channel + match) * 255).toString(16).padStart(2, '0')
        ).join('')}`;
    }

    return {
        secondary: hslToHex(34),
        highlight: hslToHex(195)
    };
}

function getAccessibleAccent(hex, mode) {
    const color = hexToRgb(hex);
    const background = hexToRgb(themeColors.background[mode]);
    const destination = mode === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };

    if (contrastRatio(color, background) >= 4.5) return hex;

    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 16; iteration += 1) {
        const middle = (low + high) / 2;
        const candidate = hexToRgb(blendColor(color, destination, middle));
        if (contrastRatio(candidate, background) >= 4.5) high = middle;
        else low = middle;
    }

    return blendColor(color, destination, high);
}

function initializeThemeStudio() {
    const root = document.documentElement;
    const swatches = document.querySelectorAll('.theme-swatch');
    const colorPicker = document.querySelector('#custom-accent');
    const modeToggle = document.querySelector('#theme-mode-toggle');
    const panelToggle = document.querySelector('#theme-panel-toggle');
    const themeControls = document.querySelector('.theme-controls');
    const savedAccent = localStorage.getItem('portfolio-accent');
    const savedMode = localStorage.getItem('portfolio-mode');
    const hexColorPattern = /^#[0-9a-f]{6}$/i;
    let accent = hexColorPattern.test(savedAccent || '') ? savedAccent : '#FFD6E7';
    let mode = savedMode === 'dark' ? 'dark' : 'light';

    function applyTheme() {
        const rgb = hexToRgb(accent);
        const palette = createCoordinatedColors(accent);
        const onAccent = contrastRatio(rgb, { r: 52, g: 43, b: 58 }) >= 4.5 ? '#342B3A' : '#FFFFFF';

        root.dataset.theme = mode;
        root.style.setProperty('--accent-color', accent);
        root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        root.style.setProperty('--accent', getAccessibleAccent(accent, mode));
        root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.36)`);
        root.style.setProperty('--on-accent', onAccent);
        root.style.setProperty('--palette-secondary', palette.secondary);
        root.style.setProperty('--palette-highlight', palette.highlight);

        colorPicker.value = accent;
        swatches.forEach((swatch) => {
            swatch.setAttribute('aria-pressed', String(swatch.dataset.color.toLowerCase() === accent.toLowerCase()));
        });
        modeToggle.setAttribute('aria-pressed', String(mode === 'dark'));
        modeToggle.setAttribute('aria-label', `Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`);
        modeToggle.querySelector('i').className = `fa-solid ${mode === 'dark' ? 'fa-sun' : 'fa-moon'}`;
        modeToggle.querySelector('span').textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
        panelToggle.setAttribute('aria-label', `Open color palette. Current color ${accent}`);

        localStorage.setItem('portfolio-accent', accent);
        localStorage.setItem('portfolio-mode', mode);
    }

    swatches.forEach((swatch) => {
        swatch.addEventListener('click', () => {
            accent = swatch.dataset.color;
            applyTheme();
        });
    });

    colorPicker.addEventListener('input', () => {
        accent = colorPicker.value;
        applyTheme();
    });

    modeToggle.addEventListener('click', () => {
        mode = mode === 'dark' ? 'light' : 'dark';
        applyTheme();
    });

    panelToggle.addEventListener('click', () => {
        const isOpen = themeControls.classList.toggle('is-open');
        panelToggle.setAttribute('aria-expanded', String(isOpen));
    });

    applyTheme();
}

function initializeSkillsAnimation() {
    const section = document.querySelector('#skills');
    if (!section) return;

    const fills = section.querySelectorAll('.skill-bar-fill');
    const animationFrames = new Map();

    function setProgress(fill, value) {
        const progress = Math.min(100, Math.max(0, value));
        const percentage = Math.round(progress);
        const progressBar = fill.closest('.skill-bar');
        const counter = fill.closest('.skill-card').querySelector('.skill-percentage');

        fill.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', String(percentage));
        counter.value = `${percentage}%`;
        counter.textContent = `${percentage}%`;
    }

    function animateFill(fill) {
        const target = Number(fill.dataset.target);
        if (!Number.isFinite(target) || target < 0 || target > 100) {
            throw new Error(`Invalid skill progress target: ${fill.dataset.target}`);
        }

        setProgress(fill, 0);

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setProgress(fill, target);
            return;
        }

        const duration = 2500;
        let startTime;

        function frame(timestamp) {
            if (startTime === undefined) startTime = timestamp;
            const elapsed = Math.min(1, (timestamp - startTime) / duration);
            const eased = 1 - (1 - elapsed) ** 3;
            setProgress(fill, target * eased);

            if (elapsed < 1) {
                animationFrames.set(fill, requestAnimationFrame(frame));
            } else {
                animationFrames.delete(fill);
                setProgress(fill, target);
            }
        }

        animationFrames.set(fill, requestAnimationFrame(frame));
    }

    fills.forEach((fill) => setProgress(fill, 0));

    const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        fills.forEach(animateFill);
    }, { threshold: 0.25 });

    observer.observe(section);
    window.addEventListener('pagehide', () => {
        observer.disconnect();
        animationFrames.forEach((frame) => cancelAnimationFrame(frame));
        animationFrames.clear();
    }, { once: true });
}

function initializeContactFooter() {
    const year = document.querySelector('#current-year');
    if (year) year.textContent = String(new Date().getFullYear());

    const revealElements = document.querySelectorAll('.contact-reveal');
    if (!revealElements.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        revealElements.forEach((element) => element.classList.add('is-visible'));
        return;
    }

    document.body.classList.add('has-contact-reveal');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.15 });

    revealElements.forEach((element) => observer.observe(element));
}

function initializeSectionAnimations() {
    const sections = document.querySelectorAll('main > section, .footer');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || !('IntersectionObserver' in window)) {
        sections.forEach((section) => section.classList.add('motion-visible'));
        return;
    }

    document.body.classList.add('has-section-motion');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('motion-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12 });

    sections.forEach((section) => observer.observe(section));
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

const roles = [
    'Frontend Developer',
    'UI Designer',
    'Creative Coder'
];
const typedText = document.querySelector('.typed-text');
let charIndex = 0;
let roleIndex = 0;
let typingForward = true;

function updateRole() {
    if (!typedText) return;
    const currentRole = roles[roleIndex];
    typedText.textContent = currentRole.slice(0, charIndex);

    if (typingForward) {
        if (charIndex < currentRole.length) {
            charIndex += 1;
        } else {
            typingForward = false;
            setTimeout(updateRole, 1200);
            return;
        }
    } else {
        if (charIndex > 0) {
            charIndex -= 1;
        } else {
            typingForward = true;
            roleIndex = (roleIndex + 1) % roles.length;
        }
    }

    setTimeout(updateRole, typingForward ? 90 : 50);
}

window.addEventListener('DOMContentLoaded', () => {
    initializeThemeStudio();
    initializeSkillsAnimation();
    initializeContactFooter();
    initializeSectionAnimations();
    updateRole();

    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navbar = document.querySelector('.navbar');
    const themeControls = document.querySelector('.theme-controls');
    const themePanelToggle = document.querySelector('#theme-panel-toggle');

    function setThemePanelOpen(isOpen) {
        themeControls.classList.toggle('is-open', isOpen);
        themePanelToggle.setAttribute('aria-expanded', String(isOpen));
    }

    function setMenuOpen(isOpen) {
        menuToggle.setAttribute('aria-expanded', String(isOpen));
        menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        menuToggle.querySelector('i').classList.toggle('fa-bars', !isOpen);
        menuToggle.querySelector('i').classList.toggle('fa-xmark', isOpen);
        navbar.classList.toggle('is-open', isOpen);
    }

    menuToggle.addEventListener('click', () => {
        setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
    });

    navbar.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('click', (event) => {
        if (!header.contains(event.target)) setMenuOpen(false);
        if (!themeControls.contains(event.target)) setThemePanelOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
            setMenuOpen(false);
            menuToggle.focus();
        }
        if (event.key === 'Escape' && themePanelToggle.getAttribute('aria-expanded') === 'true') {
            setThemePanelOpen(false);
            themePanelToggle.focus();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 800) setMenuOpen(false);
    });

    const slides = document.querySelectorAll('.about-slide');
    const dots = document.querySelectorAll('.dot');

    if (slides.length) {
        let currentSlide = 0;

        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });

            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
                dot.setAttribute('aria-current', i === index ? 'true' : 'false');
            });
        }

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                currentSlide = index;
                showSlide(currentSlide);
            });
        });

        setInterval(() => {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }, 3000);
    }

    const carousel = document.querySelector('.portfolio-carousel');
    if (!carousel) return;

    const track = carousel.querySelector('.portfolio-grid');
    const slideTrack = carousel.querySelector('.project-slides');
    const projectCards = Array.from(carousel.querySelectorAll('.project-card'));
    const previousButton = carousel.querySelector('[data-direction="previous"]');
    const nextButton = carousel.querySelector('[data-direction="next"]');
    const status = carousel.querySelector('.carousel-status');
    if (!track || !slideTrack || !projectCards.length || !previousButton || !nextButton || !status) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const portfolioSection = carousel.closest('.portfolio');
    const autoplayDelay = 4000;
    let currentPage = 0;
    let visibleCount = 3;
    let autoplayTimer;
    let isPaused = false;

    function updateCarousel() {
        const previousStart = currentPage * visibleCount;
        visibleCount = window.matchMedia('(max-width: 600px)').matches
            ? 1
            : window.matchMedia('(max-width: 1000px)').matches ? 2 : 3;
        const pageCount = Math.ceil(projectCards.length / visibleCount);
        currentPage = Math.min(Math.floor(previousStart / visibleCount), pageCount - 1);
        const startIndex = currentPage * visibleCount;
        const endIndex = Math.min(startIndex + visibleCount, projectCards.length);
        const firstCard = projectCards[0];
        const cardGap = parseFloat(getComputedStyle(slideTrack).columnGap) || 0;
        const cardStep = firstCard.getBoundingClientRect().width + cardGap;

        slideTrack.style.transitionDuration = reducedMotion.matches ? '0ms' : '600ms';
        slideTrack.style.transform = `translateX(-${startIndex * cardStep}px)`;
        projectCards.forEach((card, index) => {
            const isVisible = index >= startIndex && index < endIndex;
            card.classList.toggle('is-current', isVisible);
            card.setAttribute('aria-hidden', String(!isVisible));
            card.inert = !isVisible;
        });
        status.textContent = `${startIndex + 1}–${endIndex} of ${projectCards.length}`;
    }

    let revealObserver;
    if (portfolioSection) {
        if (reducedMotion.matches || !('IntersectionObserver' in window)) {
            portfolioSection.classList.add('is-visible');
        } else {
            revealObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    portfolioSection.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                });
            }, { threshold: 0.15 });
            revealObserver.observe(portfolioSection);
        }
    }

    function clearAutoplay() {
        if (autoplayTimer !== undefined) {
            window.clearTimeout(autoplayTimer);
            autoplayTimer = undefined;
        }
    }

    function scheduleAutoplay() {
        clearAutoplay();
        if (isPaused) return;

        autoplayTimer = window.setTimeout(() => {
            const pageCount = Math.ceil(projectCards.length / visibleCount);
            currentPage = (currentPage + 1) % pageCount;
            updateCarousel();
            scheduleAutoplay();
        }, autoplayDelay);
    }

    function moveCarousel(direction) {
        const pageCount = Math.ceil(projectCards.length / visibleCount);
        currentPage = (currentPage + direction + pageCount) % pageCount;
        updateCarousel();
        scheduleAutoplay();
    }

    function pauseAutoplay() {
        isPaused = true;
        clearAutoplay();
    }

    function resumeAutoplay() {
        isPaused = false;
        scheduleAutoplay();
    }

    function handleKeydown(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        moveCarousel(event.key === 'ArrowRight' ? 1 : -1);
    }

    const showPrevious = () => moveCarousel(-1);
    const showNext = () => moveCarousel(1);
    const handleResize = () => {
        updateCarousel();
        scheduleAutoplay();
    };
    const handleMotionPreferenceChange = () => updateCarousel();

    previousButton.addEventListener('click', showPrevious);
    nextButton.addEventListener('click', showNext);
    carousel.addEventListener('mouseenter', pauseAutoplay);
    carousel.addEventListener('mouseleave', resumeAutoplay);
    track.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);
    reducedMotion.addEventListener('change', handleMotionPreferenceChange);
    updateCarousel();
    scheduleAutoplay();

    window.addEventListener('pagehide', () => {
        clearAutoplay();
        if (revealObserver) revealObserver.disconnect();
        previousButton.removeEventListener('click', showPrevious);
        nextButton.removeEventListener('click', showNext);
        carousel.removeEventListener('mouseenter', pauseAutoplay);
        carousel.removeEventListener('mouseleave', resumeAutoplay);
        track.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('resize', handleResize);
        reducedMotion.removeEventListener('change', handleMotionPreferenceChange);
    }, { once: true });
});