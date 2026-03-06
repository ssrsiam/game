class CrashGame {
    constructor() {
        this.gameState = 'WAITING'; // WAITING, STARTING, FLYING, CRASHED
        this.multiplier = 1.00;
        this.crashPoint = 0;
        this.startTime = 0;
        this.hasBetInWaiting = false;
        this.balance = 10000.00;
        this.updateBalanceDisplay(); // Added: Initialize balance display
        this.bets = [];
        this.history = []; // Array to store recent crash points
        this.myHistory = []; // Added: Track user's own bets (Amount, Mult, Win/Loss)

        // DOM Elements
        this.counterEl = document.querySelector('.crash-game__counter');
        this.planeEl = document.querySelector('.crash-game__wrap .crash-game__pin');
        this.waitingPlaneEl = document.querySelector('.crash-game__pin--waiting');
        this.svgStrokeEl = document.querySelector('.crash-game__stroke');
        this.svgCircleEl = document.querySelector('.crash-game__svg circle');
        this.waitingOverlay = document.querySelector('.crash-game__waiting');
        this.betButtons = document.querySelectorAll('.place-bet-btn');
        this.inputs = document.querySelectorAll('.input-group input');
        this.explosionEl = document.querySelector('.crash-explosion');
        this.shineEl = document.querySelector('.crash-game__shine');
        this.balanceValEl = document.querySelector('.balance-value');
        this.countdownContainer = document.querySelector('.crash-countdown-container');
        this.bigCountdownEl = document.querySelector('.crash-game__big-countdown');
        this.countdownArcEl = document.querySelector('.countdown-arc');
        this.gameContainer = document.querySelector('.crash-game');
        this.gameRoot = document.querySelector('.crash');
        this.historyModal = document.getElementById('historyModal');
        this.historyListEl = document.getElementById('historyList');
        this.myHistoryListEl = document.getElementById('myHistoryList');
        this.historyCloseBtn = document.querySelector('.history-modal__close');
        this.historyTabs = document.querySelectorAll('.history-tab');
        this.tableEl = document.querySelector('.live-table');
        this.statsValues = document.querySelectorAll('.stat-value');

        // Notification element (Win Banner)
        this.winBannerEl = document.getElementById('crashWinBanner');
        this.winTextEl = document.getElementById('crashWinText');

        // Flight track data for explosion positioning
        this.lastX = 15;
        this.lastY = 107;

        this.countdownTime = 0;
        this.countdownInterval = null;

        // Hide components initially
        if (this.svgCircleEl) this.svgCircleEl.style.display = 'none';
        if (this.explosionEl) this.explosionEl.style.display = 'none';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateBalanceDisplay();
        this.resetGame();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    setupEventListeners() {
        this.betButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (this.gameState === 'WAITING' || this.gameState === 'STARTING') {
                    this.placeBet(index);
                } else if (this.gameState === 'FLYING') {
                    this.cashOut(index);
                }
            });
        });

        document.querySelectorAll('.q-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = e.target.textContent;
                const input = e.target.closest('.bet-card').querySelector('input');
                input.value = amount;
            });
        });

        document.querySelectorAll('.clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = e.target.closest('.input-group').querySelector('input');
                input.value = '0';
            });
        });

        const historyBtn = document.querySelector('[data-testid="game-history-btn"]');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.showHistory());
        }

        if (this.historyCloseBtn) {
            this.historyCloseBtn.addEventListener('click', () => {
                this.historyModal.classList.remove('active');
            });
        }

        if (this.historyModal) {
            this.historyModal.addEventListener('click', (e) => {
                if (e.target === this.historyModal) {
                    this.historyModal.classList.remove('active');
                }
            });
        }

        // Tab Switching Logic
        this.historyTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.historyTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const target = tab.getAttribute('data-tab');
                document.querySelectorAll('.history-content').forEach(content => {
                    content.classList.remove('active');
                });

                if (target === 'game') {
                    if (this.historyListEl) this.historyListEl.classList.add('active');
                } else {
                    if (this.myHistoryListEl) this.myHistoryListEl.classList.add('active');
                }
            });
        });
    }

    updateBalanceDisplay() {
        if (this.balanceValEl) {
            this.balanceValEl.textContent = this.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    showNotification(message, type = 'success') {
        if (!this.winBannerEl || !this.winTextEl) return;

        // Clear previous state
        if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
        this.winBannerEl.classList.remove('crash-win-banner--success', 'crash-win-banner--error', 'crash-win-banner--info', 'show');

        // Set content and type
        this.winTextEl.textContent = message;
        this.winBannerEl.classList.add(`crash-win-banner--${type}`);
        this.winBannerEl.style.display = 'flex';

        // Animate in
        requestAnimationFrame(() => {
            this.winBannerEl.classList.add('show');
        });

        // Set timeout to hide
        this.notificationTimeout = setTimeout(() => {
            this.winBannerEl.classList.remove('show');
            setTimeout(() => {
                if (!this.winBannerEl.classList.contains('show')) {
                    this.winBannerEl.style.display = 'none';
                }
            }, 300);
        }, 3000);
    }

    placeBet(index) {
        const amount = parseFloat(this.inputs[index].value);
        if (isNaN(amount) || amount <= 0) return;
        if (amount > this.balance) {
            this.showNotification('Insufficient balance', 'error');
            return;
        }

        // Only allow betting in WAITING or STARTING states
        if (this.gameState !== 'WAITING' && this.gameState !== 'STARTING') {
            this.showNotification('Wait for the next round', 'error');
            return;
        }

        this.balance -= amount;
        this.updateBalanceDisplay();
        this.showNotification(`Bet of ${amount} BDT placed!`, 'success');

        // Add bet with status
        this.bets.push({
            amount,
            index,
            cashedOut: false,
            winAmount: 0
        });
        this.hasBetInWaiting = true;

        const btn = this.betButtons[index];
        btn.classList.add('bet-placed');
        btn.querySelector('span').textContent = 'BET PLACED';
        btn.disabled = true;

        if (this.gameState === 'WAITING') {
            // No longer calling startCountdown() manually, it runs in a loop
        }
    }

    cashOut(index) {
        if (this.gameState !== 'FLYING') return;

        const bet = this.bets.find(b => b.index === index && !b.cashedOut);
        if (!bet) return;

        bet.cashedOut = true;
        bet.winAmount = bet.amount * this.multiplier;

        this.balance += bet.winAmount;
        this.updateBalanceDisplay();

        this.showNotification(`Cashed out at ${this.multiplier.toFixed(2)}x! Won ${bet.winAmount.toFixed(2)} BDT`, 'success');

        const btn = this.betButtons[index];
        btn.classList.remove('cash-out-active');
        btn.classList.add('cashed-out');
        const small = btn.querySelector('small');
        if (small) small.style.display = 'none';
        btn.querySelector('span').textContent = 'COLLECTED';
        btn.disabled = true;

        // Add to My History
        this.myHistory.unshift({
            amount: bet.amount,
            multiplier: this.multiplier.toFixed(2),
            win: true,
            winAmount: bet.winAmount.toFixed(2)
        });
        if (this.myHistory.length > 20) this.myHistory.pop();
    }

    generateCrashPoint() {
        // Purely random distribution independent of balance
        const r = Math.random();

        // 3% chance for a 1.00x "instant bust"
        if (r < 0.03) return "1.00";

        // Standard crash point formula: 99 / (1 - random)
        // Capped at 10.00 as requested
        let crashPoint = 0.99 / (1 - Math.random());

        return Math.min(10.00, Math.max(1.00, crashPoint)).toFixed(2);
    }

    resetGame() {
        this.gameState = 'WAITING';
        this.multiplier = 1.00;
        this.hasBetInWaiting = false;
        this.bets = [];

        // Clear plane state
        this.planeEl.style.display = 'none';
        this.planeEl.style.opacity = '0';
        this.planeEl.classList.remove('crash-game__pin--flying');

        // Reset positions
        this.lastX = 15;
        this.lastY = 107;

        // Match high-precision positioning logic
        const rect = this.gameContainer.getBoundingClientRect();
        const pxX = (15 / 320) * rect.width;
        const pxY = (107 / 128) * rect.height;
        this.planeEl.style.left = '0';
        this.planeEl.style.top = '0';
        this.planeEl.style.transform = `translate3d(${pxX}px, ${pxY}px, 0) translate(-50%, -50%) rotate(-15deg)`;

        this.svgStrokeEl.setAttribute('d', 'M15 107');
        this.explosionEl.style.display = 'none';
        this.explosionEl.classList.remove('active');
        if (this.gameRoot) {
            this.gameRoot.classList.remove('is-crashed', 'is-starting', 'is-flying');
        }

        this.shineEl.classList.remove('crash-game__shine--flying');
        this.shineEl.classList.add('crash-game__shine--waiting');

        this.betButtons.forEach((btn, index) => {
            btn.classList.remove('bet-placed', 'cash-out-active', 'cashed-out');
            btn.querySelector('span').textContent = 'Place a Bet';
            const small = btn.querySelector('small');
            if (small) {
                small.style.display = 'block';
                small.textContent = '(on the next round)';
            }
            btn.disabled = false;
        });

        // RECURSIVE START: Begin the 6s countdown automatically
        this.startCountdown();
    }

    startCountdown() {
        if (this.gameState === 'STARTING') return;
        this.gameState = 'STARTING';
        this.crashPoint = this.generateCrashPoint();

        this.countdownTime = 6.0;
        this.waitingOverlay.style.display = 'flex';
        this.waitingOverlay.style.opacity = '1';

        if (this.countdownInterval) clearInterval(this.countdownInterval);

        this.countdownInterval = setInterval(() => {
            this.countdownTime -= 0.1;
            if (this.countdownTime <= 0) {
                this.countdownTime = 0;
                clearInterval(this.countdownInterval);
                this.startFlight();
            }
            this.updateUI();
        }, 100);
    }

    startFlight() {
        this.gameState = 'FLYING';
        this.multiplier = 1.00;
        this.flightStartTime = Date.now(); // Initialize to avoid NaN if checked early
        this.startTime = performance.now();
        if (this.gameRoot) {
            this.gameRoot.classList.remove('is-starting', 'is-crashed');
            this.gameRoot.classList.add('is-flying');
        }

        // Hide waiting overlay completely
        this.waitingOverlay.style.opacity = '0';
        setTimeout(() => {
            if (this.gameState === 'FLYING') {
                this.waitingOverlay.style.display = 'none';
            }
        }, 300);

        if (this.waitingPlaneEl) this.waitingPlaneEl.style.display = 'none';
        if (this.shineEl) this.shineEl.style.display = 'none';

        // Show flight plane and enable sprite animation
        this.planeEl.style.display = 'block';
        this.planeEl.style.opacity = '1';
        if (this.shineEl) {
            this.shineEl.style.display = 'block';
            this.shineEl.style.opacity = '0.4';
        }
        this.planeEl.classList.add('crash-game__pin--flying');

        // Update shine class
        this.shineEl.classList.remove('crash-game__shine--waiting');
        this.shineEl.classList.add('crash-game__shine--flying');
    }

    updateMultiplier(currentTime) {
        if (this.gameState !== 'FLYING') return;

        const elapsed = Math.max(0, (currentTime - this.startTime) / 1000);
        // Even faster initial growth: coefficients increased
        this.multiplier = 1 + (elapsed * 0.18 * (1 + elapsed * 0.06));

        if (this.multiplier >= this.crashPoint) {
            this.crash();
        }
    }

    crash() {
        this.gameState = 'CRASHED';
        this.multiplier = parseFloat(this.crashPoint);
        if (this.gameRoot) {
            this.gameRoot.classList.add('is-crashed');
            this.gameRoot.classList.remove('is-flying');
        }

        // Hide plane immediately
        this.planeEl.style.display = 'none';
        this.planeEl.style.opacity = '0';
        this.planeEl.classList.remove('crash-game__pin--flying');

        // Position explosion using internal 320x128 grid mapped to percentages
        this.explosionEl.style.display = 'block';
        this.explosionEl.style.left = `${(this.lastX / 320) * 100}%`;
        this.explosionEl.style.top = `${(this.lastY / 128) * 100}%`;
        this.explosionEl.classList.remove('active');
        void this.explosionEl.offsetWidth; // Trigger reflow to restart animation
        this.explosionEl.classList.add('active');

        // Determine notification message
        const activeBet = this.bets.find(b => !b.cashedOut);
        if (activeBet) {
            this.showNotification('Next time you can try your luck', 'error');

            // Add all failed bets to My History
            this.bets.forEach(bet => {
                if (!bet.cashedOut) {
                    this.myHistory.unshift({
                        amount: bet.amount,
                        multiplier: this.multiplier.toFixed(2),
                        win: false,
                        winAmount: '0.00'
                    });
                }
            });
            if (this.myHistory.length > 20) this.myHistory.pop();
        } else if (this.bets.length === 0) {
            this.showNotification('Round ended. Next round starts soon!', 'info');
        }

        this.history.unshift(this.multiplier.toFixed(2));
        if (this.history.length > 20) this.history.pop();

        setTimeout(() => {
            if (this.gameState === 'CRASHED') this.resetGame();
        }, 3000); // Reset faster
    }

    updateUI() {
        if (this.gameState === 'STARTING') {
            const timeInt = Math.ceil(this.countdownTime);
            if (this.countdownContainer) this.countdownContainer.style.display = 'grid'; // Maintain grid centering
            if (this.bigCountdownEl) {
                this.bigCountdownEl.textContent = timeInt > 0 ? timeInt : '';
            }
            if (this.gameRoot) this.gameRoot.classList.add('is-starting');
            if (this.waitingPlaneEl) this.waitingPlaneEl.style.display = 'none';
            if (this.planeEl) this.planeEl.style.display = 'none';
            if (this.shineEl) this.shineEl.style.display = 'none';

            this.counterEl.style.display = 'none';
            if (this.waitingOverlay.querySelector('.crash-game__text')) {
                this.waitingOverlay.querySelector('.crash-game__text').style.display = 'none';
            }
        } else if (this.gameState === 'FLYING' || this.gameState === 'CRASHED') {
            if (this.countdownContainer) this.countdownContainer.style.display = 'none';
            if (this.gameRoot) this.gameRoot.classList.remove('is-starting');
            if (this.waitingPlaneEl) this.waitingPlaneEl.style.display = 'none';

            this.counterEl.style.display = 'block';
            this.counterEl.textContent = `${this.multiplier.toFixed(2)}x`;
            this.counterEl.classList.remove('is-countdown');
        } else if (this.gameState === 'WAITING') {
            if (this.waitingPlaneEl) this.waitingPlaneEl.style.display = 'block';
            if (this.countdownContainer) this.countdownContainer.style.display = 'none';
            this.counterEl.style.display = 'none';
            if (this.waitingOverlay.querySelector('.crash-game__text')) {
                this.waitingOverlay.querySelector('.crash-game__text').style.display = 'block';
                this.waitingOverlay.querySelector('.crash-game__text').textContent = 'Waiting for you to place your first bet...';
            }
            if (this.gameRoot) this.gameRoot.classList.remove('is-starting');
        }

        if (this.gameState === 'FLYING') {
            if (this.svgStrokeEl) {
                this.svgStrokeEl.style.display = 'block';
                this.svgStrokeEl.style.opacity = '1';
            }

            const maxVisibleX = 260; // Expanded to make room for leveling-off sweep
            const maxVisibleY = 100; // Increased from 90 to make the plane fly higher

            // Progress mapping: use a tighter curve for the cap at 10x
            const rawProgress = Math.max(0, Math.min(1, Math.log10(this.multiplier) / Math.log10(10)));
            const progress = rawProgress;

            // Base coordinates for the trail (smooth linear path)
            const yPlane = 107 - (progress * maxVisibleY);
            const x = 15 + (progress * maxVisibleX);

            this.lastX = x;
            this.lastY = yPlane; // Keep last position for explosion

            // HIGH-PRECISION POSITIONING WITH TRANSLATE3D
            // Convert internal 320x128 grid to real container pixels
            const rect = this.gameContainer.getBoundingClientRect();
            const pxX = (x / 320) * rect.width;
            const pxY = (yPlane / 128) * rect.height;

            // NON-LINEAR ROTATION (JITTER REMOVED AS REQUESTED)
            const climbBase = Math.sin(progress * Math.PI);
            const angleDegPlane = -15 - (climbBase * 25) + (progress * 5);

            // We use -50%, -50% for centering, then pxX, pxY for absolute position
            this.planeEl.style.left = '0';
            this.planeEl.style.top = '0';
            this.planeEl.style.transform = `translate3d(${pxX}px, ${pxY}px, 0) translate(-50%, -50%) rotate(${angleDegPlane}deg)`;

            // CALIBRATED TRAIL ATTACHMENT
            const angleRadBase = angleDegPlane * Math.PI / 180;

            // Adjust offsets to bring the line flush with the back of the golden plane image.
            // The image has transparent padding, so the visual tail is closer to the center.
            const tailOffsetX = -10; // Reduced negative offset to bring line closer to plane body
            const tailOffsetY = 2;

            const tailAttachX = x + (tailOffsetX * Math.cos(angleRadBase) - tailOffsetY * Math.sin(angleRadBase));
            const tailAttachY = yPlane + (tailOffsetX * Math.sin(angleRadBase) + tailOffsetY * Math.cos(angleRadBase));

            // REDESIGNED TRAIL (CONCAVE SWEEP - "Coming from below")
            const controlX = 15 + (tailAttachX - 15) * 0.5;
            const controlY = 107;

            const d = `M15 107 Q${controlX} ${controlY} ${tailAttachX} ${tailAttachY}`;
            if (!isNaN(tailAttachX) && !isNaN(tailAttachY)) {
                this.svgStrokeEl.setAttribute('d', d);
            }

            // Update Collect buttons UI
            this.bets.forEach(bet => {
                if (bet.cashedOut) return;
                const btn = this.betButtons[bet.index];
                btn.classList.remove('bet-placed');
                btn.classList.add('cash-out-active');
                btn.disabled = false;

                const small = btn.querySelector('small');
                if (small) small.style.display = 'none';

                const potentialWin = (bet.amount * this.multiplier).toFixed(2);
                btn.querySelector('span').textContent = 'COLLECT';
            });
        }
    }


    showHistory() {
        if (!this.historyModal || !this.historyListEl) return;

        this.historyListEl.innerHTML = '';

        if (this.history.length === 0) {
            this.historyListEl.innerHTML = '<p style="color: #666; width: 100%; text-align: center;">No games yet</p>';
        } else {
            this.history.forEach(val => {
                const item = document.createElement('div');
                const num = parseFloat(val);
                let type = 'low';
                if (num >= 10) type = 'high';
                else if (num >= 2) type = 'med';

                item.className = `history-item history-item--${type}`;
                item.textContent = `${val}x`;
                this.historyListEl.appendChild(item);
            });
        }

        this.historyModal.classList.add('active');
        this.updateMyHistoryUI();
    }

    updateMyHistoryUI() {
        if (!this.myHistoryListEl) return;
        this.myHistoryListEl.innerHTML = '';

        if (this.myHistory.length === 0) {
            this.myHistoryListEl.innerHTML = '<p style="color: #666; width: 100%; text-align: center; margin-top: 20px;">No bets recorded yet</p>';
        } else {
            this.myHistory.forEach(data => {
                const item = document.createElement('div');
                item.className = `my-bet-item ${data.win ? 'my-bet-item--win' : 'my-bet-item--loss'}`;

                item.innerHTML = `
                    <div class="my-bet-item__col">
                        <span class="my-bet-item__label">Bet</span>
                        <span class="my-bet-item__val">${parseFloat(data.amount).toFixed(2)} BDT</span>
                    </div>
                    <div class="my-bet-item__col">
                        <span class="my-bet-item__label">Multiplier</span>
                        <span class="my-bet-item__val">${data.multiplier}x</span>
                    </div>
                    <div class="my-bet-item__win">
                        <span class="my-bet-item__label">${data.win ? 'Profit' : 'Loss'}</span>
                        <span class="my-bet-item__val">${data.win ? '+' : '-'}${data.winAmount} BDT</span>
                    </div>
                `;
                this.myHistoryListEl.appendChild(item);
            });
        }
    }

    simulateLiveData() {
        if (!this.tableEl || !this.statsValues || this.statsValues.length < 3) return;
        if (Math.random() > 0.3) return;

        // Update stats bar
        const currentBets = parseInt(this.statsValues[0].textContent.replace('👤 ', ''));
        const newBetsCount = Math.max(100, currentBets + (Math.random() > 0.5 ? 1 : -1));
        this.statsValues[0].textContent = `👤 ${newBetsCount}`;

        const currentTotal = parseFloat(this.statsValues[1].textContent.replace('💰 ', '').replace(' BDT', ''));
        const newTotal = currentTotal + (Math.random() * 50);
        this.statsValues[1].textContent = `💰 ${newTotal.toFixed(2)} BDT`;

        const rows = Array.from(this.tableEl.querySelectorAll('.table-row'));
        if (rows.length === 0) return;

        const rowIndex = Math.floor(Math.random() * rows.length);
        const row = rows[rowIndex];

        const oddsCol = row.querySelector('.odds-col') || row.querySelector('.zero-odds');
        const betCol = row.querySelector('.bet-col');
        const winCol = row.querySelector('.win-col');

        if (this.gameState === 'FLYING') {
            if (oddsCol) {
                oddsCol.textContent = `x${this.multiplier.toFixed(2)}`;
                oddsCol.className = 'odds-col';
                oddsCol.style.color = '#ff9100';
            }
            if (winCol && betCol) {
                const bet = parseFloat(betCol.textContent);
                winCol.textContent = `${(bet * this.multiplier).toFixed(2)} BDT`;
                winCol.style.color = '#00c853';
            }
        } else if (this.gameState === 'CRASHED') {
            if (winCol && Math.random() > 0.5) {
                winCol.textContent = '0 BDT';
                winCol.style.color = '#fff';
                if (oddsCol) {
                    oddsCol.textContent = 'x0';
                    oddsCol.className = 'zero-odds';
                    oddsCol.style.color = '';
                }
            }
        }
    }

    gameLoop(t) {
        if (this.gameState === 'FLYING') {
            this.updateMultiplier(t);
        }
        this.updateUI();
        this.simulateLiveData();
        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new CrashGame();
});
