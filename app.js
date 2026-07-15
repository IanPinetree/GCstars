class Deck {
  constructor() {
    this.slides = [...document.querySelectorAll('.slide')];
    this.stage = document.getElementById('deckStage');
    this.pageNum = document.getElementById('pageNum');
    this.navHint = document.querySelector('.nav-hint');
    this.index = 0;
    this.total = this.slides.length;

    this.slides.forEach((slide) => {
      if (slide.hasAttribute('data-build')) slide.dataset.buildStep = '0';
    });

    this.scale();
    window.addEventListener('resize', () => this.scale());
    this.bindKeyboard();
    this.bindTouch();
    this.bindWheel();

    const hashIndex = Number.parseInt(window.location.hash.slice(1), 10);
    this.go(Number.isFinite(hashIndex) && hashIndex > 0 ? hashIndex - 1 : 0);
    window.__deck = { go: (index) => this.go(index), count: this.total };
  }

  scale() {
    const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = (window.innerWidth - 1920 * factor) / 2;
    const y = (window.innerHeight - 1080 * factor) / 2;
    this.stage.style.transform = `translate(${x}px, ${y}px) scale(${factor})`;
  }

  go(index) {
    const nextIndex = Math.max(0, Math.min(index, this.total - 1));
    if (nextIndex !== this.index && this.slides[nextIndex].hasAttribute('data-build')) {
      this.slides[nextIndex].dataset.buildStep = '0';
    }

    this.index = nextIndex;
    this.slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === this.index;
      slide.classList.toggle('active', isActive);
      slide.classList.toggle('visible', isActive);
    });

    this.updateBuilds();
    this.pageNum.textContent = `${String(this.index + 1).padStart(2, '0')} / ${String(this.total).padStart(2, '0')}`;
    this.navHint.style.display = this.slides[this.index].hasAttribute('data-hidenav') ? 'none' : '';
  }

  updateBuilds() {
    this.slides.forEach((slide) => {
      const currentStep = Number.parseInt(slide.dataset.buildStep || '0', 10);
      slide.querySelectorAll('[data-build-step]').forEach((item) => {
        const requiredStep = Number.parseInt(item.dataset.buildStep || '0', 10);
        item.classList.toggle('build-visible', requiredStep <= currentStep);
      });
    });
  }

  next() {
    const slide = this.slides[this.index];
    const buildItems = [...slide.querySelectorAll('[data-build-step]')];
    const maxStep = buildItems.reduce((maximum, item) => Math.max(maximum, Number.parseInt(item.dataset.buildStep || '0', 10)), 0);
    const currentStep = Number.parseInt(slide.dataset.buildStep || '0', 10);

    if (currentStep < maxStep) {
      slide.dataset.buildStep = String(currentStep + 1);
      this.updateBuilds();
      return;
    }

    this.go(this.index + 1);
  }

  previous() {
    const slide = this.slides[this.index];
    const currentStep = Number.parseInt(slide.dataset.buildStep || '0', 10);

    if (currentStep > 0) {
      slide.dataset.buildStep = String(currentStep - 1);
      this.updateBuilds();
      return;
    }

    this.go(this.index - 1);
  }

  bindKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (event.target.getAttribute?.('contenteditable') === 'true') return;

      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        this.next();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        this.previous();
      } else if (event.key === 'Home') {
        this.go(0);
      } else if (event.key === 'End') {
        this.go(this.total - 1);
      }
    });
  }

  bindTouch() {
    let startX = null;

    window.addEventListener('touchstart', (event) => {
      startX = event.touches[0].clientX;
    }, { passive: true });

    window.addEventListener('touchend', (event) => {
      if (startX === null) return;
      const distance = event.changedTouches[0].clientX - startX;
      if (Math.abs(distance) > 60) distance < 0 ? this.next() : this.previous();
      startX = null;
    }, { passive: true });
  }

  bindWheel() {
    let locked = false;

    window.addEventListener('wheel', (event) => {
      if (locked || Math.abs(event.deltaY) < 24) return;
      locked = true;
      event.deltaY > 0 ? this.next() : this.previous();
      window.setTimeout(() => { locked = false; }, 650);
    }, { passive: true });
  }
}

class InlineEditor {
  constructor() {
    this.selector = '[data-editable]';
    this.storageKey = 'kc-deck-gcstars-setup-v1';
    this.active = false;
    this.stage = document.getElementById('deckStage');
    this.toggleButton = document.getElementById('editToggle');
    this.hotzone = document.getElementById('editHotzone');

    this.restore();
    this.bind();
  }

  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      if (saved?.version === this.stage.dataset.deckVersion && saved?.html) this.stage.innerHTML = saved.html;
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  save() {
    const state = { version: this.stage.dataset.deckVersion, html: this.stage.innerHTML };
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  toggle() {
    this.active = !this.active;
    document.body.classList.toggle('editing', this.active);
    this.toggleButton.classList.toggle('active', this.active);
    this.toggleButton.textContent = this.active ? 'DONE' : 'EDIT';

    this.stage.querySelectorAll(this.selector).forEach((element) => {
      element.setAttribute('contenteditable', String(this.active));
    });
  }

  export() {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach((element) => element.removeAttribute('contenteditable'));
    clone.querySelector('body')?.classList.remove('editing');

    const content = `<!DOCTYPE html>\n${clone.outerHTML}`;
    const blob = new Blob([content], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pinetree-deck.html';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  bind() {
    let hideTimer = null;
    const showButton = () => {
      window.clearTimeout(hideTimer);
      this.toggleButton.classList.add('show');
    };
    const hideButton = () => {
      hideTimer = window.setTimeout(() => {
        if (!this.active) this.toggleButton.classList.remove('show');
      }, 350);
    };

    this.hotzone.addEventListener('mouseenter', showButton);
    this.hotzone.addEventListener('mouseleave', hideButton);
    this.toggleButton.addEventListener('mouseenter', showButton);
    this.toggleButton.addEventListener('mouseleave', hideButton);
    this.hotzone.addEventListener('click', () => this.toggle());
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.stage.addEventListener('input', (event) => {
      if (event.target.matches(this.selector)) this.save();
    });

    document.addEventListener('keydown', (event) => {
      const isEditingText = event.target.getAttribute?.('contenteditable') === 'true';
      if ((event.key === 'e' || event.key === 'E') && !isEditingText) this.toggle();
      if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        this.export();
      }
    });
  }
}

new InlineEditor();
new Deck();
