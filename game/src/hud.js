// Harbour Line — the HUD. Plain DOM over the canvas: top score bar, round
// and timer, crosshair and hitmarker, health and ammo, kill feed, floating
// score popups, banners, and the title / pause / results screens. The game
// logic never touches the DOM directly; it calls these methods.

import { CONFIG, ROUND_NAMES } from './config.js';

function $(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'),
      youScore: $('you-score'),
      cinderScore: $('cinder-score'),
      roundLabel: $('round-label'),
      roundName: $('round-name'),
      timer: $('timer'),
      objective: $('objective'),
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      healthBar: $('health-bar'),
      healthNumber: $('health-number'),
      ammoMag: $('ammo-mag'),
      ammoReserve: $('ammo-reserve'),
      reloadHint: $('reload-hint'),
      killfeed: $('killfeed'),
      banner: $('banner'),
      floaters: $('floaters'),
      damage: $('damage'),
      menu: $('menu'),
      pause: $('pause'),
      results: $('results'),
      prompt: $('prompt'),
    };
    this.bannerTimer = null;
  }

  showHud(show) {
    this.el.hud.style.display = show ? 'block' : 'none';
    this.el.crosshair.style.display = show ? 'block' : 'none';
  }

  setScores(you, cinder) {
    this.el.youScore.textContent = you;
    this.el.cinderScore.textContent = cinder;
  }

  setRound(round) {
    this.el.roundLabel.textContent = `ROUND ${round} OF ${CONFIG.totalRounds}`;
    this.el.roundName.textContent = ROUND_NAMES[round - 1] ?? '';
  }

  setTimer(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.classList.toggle('urgent', seconds <= 15);
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setHealth(health) {
    this.el.healthBar.style.width = `${health}%`;
    this.el.healthBar.classList.toggle('low', health <= 30);
    this.el.healthNumber.textContent = Math.ceil(health);
  }

  setAmmo(mag, reserve, reloading) {
    this.el.ammoMag.textContent = mag;
    this.el.ammoReserve.textContent = reserve;
    this.el.reloadHint.style.visibility = reloading ? 'visible' : (mag === 0 ? 'visible' : 'hidden');
    this.el.reloadHint.textContent = reloading ? 'RELOADING…' : 'PRESS R — RELOAD';
  }

  flashHitmarker(headshot, still = false) {
    this.el.hitmarker.classList.remove('show', 'headshot');
    void this.el.hitmarker.offsetWidth; // restart the animation
    this.el.hitmarker.classList.add('show');
    if (headshot) this.el.hitmarker.classList.add('headshot');
    if (still) {
      // Staged screenshot: hold the marker visible instead of animating away.
      this.el.hitmarker.style.animation = 'none';
      this.el.hitmarker.style.opacity = '1';
    }
  }

  flashDamage() {
    this.el.damage.classList.remove('show');
    void this.el.damage.offsetWidth;
    this.el.damage.classList.add('show');
  }

  killfeed(text, good) {
    const item = document.createElement('div');
    item.className = 'feed-item' + (good ? ' good' : '');
    item.textContent = text;
    this.el.killfeed.prepend(item);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => item.classList.add('fade'), 3200);
    setTimeout(() => item.remove(), 4200);
  }

  floater(text, big = false, still = false) {
    const item = document.createElement('div');
    item.className = 'floater' + (big ? ' big' : '');
    item.textContent = text;
    // A little horizontal jitter so stacked popups do not overlap exactly.
    item.style.left = `${46 + Math.random() * 8}%`;
    if (still) {
      // Staged screenshot: hold the popup visible instead of animating away.
      item.style.animation = 'none';
      item.style.opacity = '1';
    }
    this.el.floaters.appendChild(item);
    setTimeout(() => item.remove(), still ? 10000 : 1100);
  }

  banner(main, sub = '') {
    this.el.banner.innerHTML = `<div class="banner-main">${main}</div>` +
      (sub ? `<div class="banner-sub">${sub}</div>` : '');
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('show'), 2400);
  }

  setPrompt(text) {
    this.el.prompt.textContent = text;
    this.el.prompt.style.display = text ? 'block' : 'none';
  }

  showMenu(show) {
    this.el.menu.style.display = show ? 'flex' : 'none';
  }

  showPause(show) {
    this.el.pause.style.display = show ? 'flex' : 'none';
  }

  showResults(show, stats) {
    if (!show) {
      this.el.results.style.display = 'none';
      return;
    }
    $('results-title').textContent = stats.won ? 'HARBOUR SECURED' : 'HARBOUR LOST';
    $('results-title').classList.toggle('won', stats.won);
    $('results-sub').textContent = stats.won
      ? 'The yard is yours. Cinder pulled out.'
      : 'Cinder holds the yard. Run it back.';
    $('stat-rounds').textContent = `${stats.roundsWon} — ${stats.roundsLost}`;
    $('stat-elims').textContent = stats.eliminations;
    $('stat-score').textContent = stats.score;
    $('stat-accuracy').textContent = `${stats.accuracy}%`;
    $('stat-streak').textContent = `x${stats.bestStreak}`;
    this.el.results.style.display = 'flex';
  }
}
