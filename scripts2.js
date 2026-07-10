document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 🛡️ DUNGEON CRAWLER STATE & CONFIG
    // ==========================================
    let hero = { hp: 50, maxHp: 50, focus: 3, maxFocus: 3, pots: 2, pots2: 2, pots3: 2, pots4: 0, pots5: 0, pots6: 0, minDmg: 4, maxDmg: 12, xp: 0, xpNeeded: 10, lvl: 1, gold: 0 };
    let activeEnemy = null;
    let currentRoom = 1;
    const maxRooms = 80;
    let isPlayerTurn = true;
    let pipWindow = null; 

    // Audio Safeguards
    let userHasInteracted = false;
    let backgroundMusic = null;

    // Keyboard Navigation State
    let currentFocusIndex = 0;
    let visibleButtons = [];

    const bestiary = [
        { name: "Goblin", hp: 15, minDmg: 2, maxDmg: 6, xp: 21, gold: 10, sprite: "Gob" },
        { name: "Skeleton", hp: 20, minDmg: 4, maxDmg: 8, xp: 30, gold: 15, sprite: "Skl" },
        { name: "Orc Brute", hp: 35, minDmg: 6, maxDmg: 12, xp: 54, gold: 25, sprite: "OrcB" },
        { name: "Chaos Cultist", hp: 25, minDmg: 8, maxDmg: 16, xp: 45, gold: 20, sprite: "Cul" },
        { name: "Orc Mage", hp: 20, minDmg: 8, maxDmg: 17, xp: 50, gold: 22, sprite: "OrcM"}
    ];

    // ==========================================
    // 🔊 SAFE AUDIO CONTROLLER
    // ==========================================
    function playSound(filePath, volume = 1.0) {
        if (!userHasInteracted) return; 
        try {
            const snd = new Audio(filePath);
            snd.volume = volume;
            snd.play().catch(err => console.warn(`Audio playback blocked:`, err));
        } catch (e) {}
    }

    function playBackgroundMusic() {
        if (!userHasInteracted) return;
        try {
            if (!backgroundMusic) {
                backgroundMusic = new Audio('Sounds/503_Frost_Giant_Ridge.mp3');
                backgroundMusic.volume = 0.3;
                backgroundMusic.loop = true;
            }
            backgroundMusic.play().catch(err => {});
        } catch (e) {}
    }

    function unlockAudioContext() {
        if (userHasInteracted) return;
        userHasInteracted = true;
        playBackgroundMusic();
        window.removeEventListener('click', unlockAudioContext);
    }
    window.addEventListener('click', unlockAudioContext);

    // ==========================================
    // 📺 DOM HELPERS & KEYBOARD UI
    // ==========================================
    function getGameElement(id) {
        const context = pipWindow ? pipWindow.document : document;
        return context.getElementById(id);
    }

    function logMsg(msg) {
        const log = getGameElement('combat-log');
        if (log) log.innerHTML = msg + "<br>" + log.innerHTML;
    }

    function flashHealthBar(elementId) {
        const bar = getGameElement(elementId);
        if (bar) {
            bar.classList.add('damage-flash');
            setTimeout(() => { bar.classList.remove('damage-flash'); }, 200);
        }
    }

    // Dynamic Keyboard Styling Injector
    function injectKeyboardStyles(doc) {
        if (!doc.getElementById('keyboard-nav-styles')) {
            const style = doc.createElement('style');
            style.id = 'keyboard-nav-styles';
            style.textContent = `
                .keyboard-focused {
                    outline: 3px solid #ffc31e !important;
                    box-shadow: 0 0 15px #ffc31e !important;
                    transform: scale(1.05);
                    transition: all 0.1s ease-in-out;
                    z-index: 10;
                }
            `;
            doc.head.appendChild(style);
        }
    }

    // Refresh which buttons the keyboard can interact with
    function refreshKeyboardFocus() {
        const context = pipWindow ? pipWindow.document : document;
        
        // 1. Find the active menu container
        let activeContainer = null;
        if (getGameElement('dungeon-game-over') && getGameElement('dungeon-game-over').style.display !== 'none') {
            activeContainer = getGameElement('dungeon-game-over');
        } else if (getGameElement('shop-menu') && getGameElement('shop-menu').style.display !== 'none') {
            activeContainer = getGameElement('shop-menu');
        } else if (getGameElement('action-menu') && getGameElement('action-menu').style.display !== 'none') {
            activeContainer = getGameElement('action-menu');
        }

        if (!activeContainer) return;

        // 2. Map all currently visible buttons inside the active menu
        const allButtons = Array.from(activeContainer.querySelectorAll('button'));
        visibleButtons = allButtons.filter(btn => btn.style.display !== 'none' && btn.offsetParent !== null);

        // 3. Prevent index out of bounds if buttons disappeared (e.g. running out of potions)
        if (currentFocusIndex >= visibleButtons.length) currentFocusIndex = visibleButtons.length - 1;
        if (currentFocusIndex < 0) currentFocusIndex = 0;

        // 4. Strip focus from all buttons, then apply to the current index
        context.querySelectorAll('.keyboard-focused').forEach(btn => btn.classList.remove('keyboard-focused'));
        
        if (visibleButtons.length > 0) {
            visibleButtons[currentFocusIndex].classList.add('keyboard-focused');
        }
    }

    function updateRPGUI() {
        if (!getGameElement('hero-lvl')) return; 

        getGameElement('hero-lvl').innerText = hero.lvl;
        getGameElement('hero-xp').innerText = hero.xp;
        getGameElement('hero-xp-needed').innerText = hero.xpNeeded;
        getGameElement('hero-gold').innerText = hero.gold;
        getGameElement('hero-hp').innerText = hero.hp;
        getGameElement('hero-maxhp').innerText = hero.maxHp;
        getGameElement('hero-focus').innerText = hero.focus;
        getGameElement('hero-maxfocus').innerText = hero.maxFocus;

        getGameElement('hero-pots').innerText = hero.pots;
        getGameElement('hero-pots2').innerText = hero.pots2;
        getGameElement('hero-pots3').innerText = hero.pots3;
        getGameElement('hero-pots4').innerText = hero.pots4;
        getGameElement('hero-pots5').innerText = hero.pots5;
        getGameElement('hero-pots6').innerText = hero.pots6;
        getGameElement('room-display').innerText = currentRoom;

        const heroHpPercent = Math.max(0, (hero.hp / hero.maxHp) * 100);
        const heroHpBar = getGameElement('hero-hp-bar');
        if (heroHpBar) {
            heroHpBar.style.width = heroHpPercent + '%';
            if (heroHpPercent > 50) heroHpBar.style.backgroundColor = '#2ed573';
            else if (heroHpPercent > 25) heroHpBar.style.backgroundColor = '#ffa502';
            else heroHpBar.style.backgroundColor = '#ff4757';
        }

        const enemyStats = getGameElement('enemy-stats');
        if (activeEnemy) {
            getGameElement('enemy-hp').innerText = activeEnemy.hp;
            const enemyHpPercent = Math.max(0, (activeEnemy.hp / activeEnemy.maxHp) * 100);
            getGameElement('enemy-hp-bar').style.width = enemyHpPercent + '%';
        }

        const actionMenu = getGameElement('action-menu');
        if (actionMenu && actionMenu.style.display !== 'none') {
            getGameElement('btn-heal-1').style.display = (hero.pots > 0) ? 'inline-block' : 'none';
            getGameElement('btn-heal-2').style.display = (hero.pots2 > 0) ? 'inline-block' : 'none';
            getGameElement('btn-heal-3').style.display = (hero.pots3 > 0) ? 'inline-block' : 'none';
            getGameElement('btn-heal-4').style.display = (hero.pots4 > 0) ? 'inline-block' : 'none';
            getGameElement('btn-heal-5').style.display = (hero.pots5 > 0) ? 'inline-block' : 'none';
            getGameElement('btn-heal-6').style.display = (hero.pots6 > 0) ? 'inline-block' : 'none';
        }

        // Whenever UI updates, refresh the keyboard tracker so it doesn't select hidden buttons
        refreshKeyboardFocus();
    }

    // ==========================================
    // 🎮 GAMEPLAY SYSTEM
    // ==========================================
    function checkLevelUp() {
        if (hero.xp >= hero.xpNeeded) {
            hero.lvl++; hero.xp -= hero.xpNeeded; hero.xpNeeded = Math.floor(hero.xpNeeded * 1.5);
            hero.maxHp += 10; hero.hp = hero.maxHp; hero.maxFocus += 1; hero.focus = hero.maxFocus;
            hero.minDmg += 2; hero.maxDmg += 3;
            logMsg(`<span style="color:#2ed573"><b>LEVEL UP! You are now Level ${hero.lvl}!</b></span> HP & Focus restored!`);
            playSound('Sounds/Speech Disambiguation.wav', 1.0);
            checkLevelUp(); 
        }
    }

    function calculateAttack(useFocus, useSlow = false) {
        let slots = 3; let successes = 0;
        if (useFocus && hero.focus > 0) { hero.focus--; successes++; slots--; logMsg("<i>You spend 1 Focus to aim...</i>"); } 
        else if (useSlow && hero.focus > 0) { hero.focus--; successes++; slots--; logMsg("<i>You spend 1 Focus to cast Slow...</i>"); }

        for (let i = 0; i < slots; i++) { if (Math.random() < 0.70) successes++; }
        playSound('Sounds/Windows Recycle.wav', 1.0);

        const baseDamage = hero.minDmg + Math.floor(Math.random() * (hero.maxDmg - hero.minDmg));
        let finalDamage = Math.floor(baseDamage * (successes / 3));

        if (useSlow) finalDamage = Math.floor(finalDamage * 0.5); 
        else if (useFocus && successes === 3) finalDamage = finalDamage * 3; 

        return { dmg: finalDamage, successes: successes };
    }

    function executePlayerTurn(useFocus, useSlow = false) {
        if (!isPlayerTurn || !activeEnemy) return;
        if ((useFocus || useSlow) && hero.focus <= 0) {
            logMsg("Not enough Focus!"); playSound("Sounds/Windows Unlock.wav", 1.0); return;
        }
        
        isPlayerTurn = false;
        const hit = calculateAttack(useFocus, useSlow);
        activeEnemy.hp -= hit.dmg;

        let msg = `Hero rolls [${hit.successes}/3] successes! Deals <span style="color:#ff6b81">${hit.dmg} damage</span>.`;
        if (useSlow) msg += ` <span style="color:#3498db">The enemy is slowed and loses their turn!</span>`;
        logMsg(msg);
        
        if (hit.dmg > 0) flashHealthBar('enemy-hp-bar');
        updateRPGUI();

        if (activeEnemy.hp <= 0) {
            setTimeout(() => endCombat(true), 500); 
            playSound('Sounds/Windows Notify Calendar.wav', 1.0);
        } else {
            if (useSlow) {
                setTimeout(() => { isPlayerTurn = true; logMsg("It's your turn again!"); }, 1000);
            } else if (useFocus && hit.successes === 3) {
                setTimeout(() => {
                    isPlayerTurn = true;
                    logMsg(`<b style='color:#ffa502'>Perfect strike! The ${activeEnemy.name} flinches, giving you another turn!</b>`);
                }, 1000);
            } else {
                setTimeout(enemyTurn, 1000);
            }
        }
    }

    function calculateEnemyAttack() {
        let slots = 3; let successes = 0;
        for (let i = 0; i < slots; i++) { if (Math.random() < 0.65) successes++; }
        playSound('Sounds/Windows Recycle.wav', 1.0);

        const baseDamage = activeEnemy.minDmg + Math.floor(Math.random() * (activeEnemy.maxDmg - activeEnemy.minDmg));
        const finalDamage = Math.floor(baseDamage * (successes / 3));
        return { dmg: finalDamage, successes: successes };
    }

    function enemyTurn() {
        if (!activeEnemy || activeEnemy.hp <= 0) return;
        const hit = calculateEnemyAttack();

        if (hit.successes === 0) {
            logMsg(`The ${activeEnemy.name} rolls [0/3] and misses completely!`);
        } else {
            hero.hp -= hit.dmg;
            if (hit.dmg > 0) flashHealthBar('hero-hp-bar');
            logMsg(`The ${activeEnemy.name} rolls [${hit.successes}/3] and attacks for <span style='color:#ff6b81'>${hit.dmg} damage</span>!`);
        }
        
        updateRPGUI();

        if (hero.hp <= 0) {
            playSound("Sounds/Ring09.wav", 1.0);
            getGameElement('dungeon-message').innerText = "Your Party has Fallen";
            getGameElement('dungeon-game-over').style.display = 'block';
            getGameElement('dungeon-restart-btn').style.display = 'none';
            currentFocusIndex = 0; // Reset index for game over menu
            setTimeout(() => { getGameElement('dungeon-restart-btn').style.display = 'inline-block'; updateRPGUI(); }, 5000);
        } else {
            isPlayerTurn = true;
        }
    }

    function consumePotion(type) {
        if (activeEnemy && !isPlayerTurn) return;
        let amountHealed = 0; let name = "";

        if (type === 1 && hero.pots > 0) { hero.pots--; amountHealed = 15; name = "Godsbeard 🌿"; } 
        else if (type === 2 && hero.pots2 > 0) { hero.pots2--; amountHealed = 30; name = "Super Godsbeard 🧪"; } 
        else if (type === 3 && hero.pots3 > 0) { hero.pots3--; amountHealed = 50; name = "Ultra Godsbeard 🏺"; } 
        else if (type === 4 && hero.pots4 > 0) { hero.pots4--; amountHealed = 100; name = "Super Ultra Godsbeard 💖"; } 
        else if (type === 5 && hero.pots5 > 0) { hero.pots5--; amountHealed = 150; name = "Super Supreme Ultra Godsbeard 💖🌿"; } 
        else if (type === 6 && hero.pots6 > 0) { hero.pots6--; amountHealed = 200; name = "Hyper Supreme Ultra Godsbeard 💖🧪"; } 
        else { logMsg("<i>You do not have any of that potion left!</i>"); return; }

        playSound('Sounds/Windows Logon.wav', 1.0);
        hero.hp = Math.min(hero.maxHp, hero.hp + amountHealed);
        logMsg(`Hero uses ${name} and heals <span style='color:#2ed573'>${amountHealed} HP</span>.`);
        updateRPGUI();
        
        if (activeEnemy) { isPlayerTurn = false; setTimeout(enemyTurn, 1000); }
    }

    // ==========================================
    // 🗺️ PROGRESSION & SHOP
    // ==========================================
    function showShop() {
        logMsg("<span style='color:gold;'>A traveling merchant offers their wares...</span>");
        getGameElement('btn-buy-pot4').style.display = (currentRoom > 14) ? 'inline-block' : 'none';
        getGameElement('btn-buy-pot5').style.display = (currentRoom > 49) ? 'inline-block' : 'none';
        getGameElement('btn-buy-pot6').style.display = (currentRoom > 59) ? 'inline-block' : 'none';
        getGameElement('action-menu').style.display = 'none';
        getGameElement('shop-menu').style.display = 'block';
        currentFocusIndex = 0; // reset focus index for shop
        updateRPGUI();
    }

    function spawnRoom() {
        if (currentRoom > maxRooms) {
            getGameElement('dungeon-message').innerText = "The Dungeon is Cleared!";
            getGameElement('dungeon-game-over').style.display = 'block';
            return;
        }

        const scaleMultiplier = 1 + (hero.lvl - 1) * 0.35;
        const randomEnemy = bestiary[Math.floor(Math.random() * bestiary.length)];
        activeEnemy = JSON.parse(JSON.stringify(randomEnemy));
        
        activeEnemy.maxHp = Math.floor(activeEnemy.hp * scaleMultiplier);
        activeEnemy.hp = activeEnemy.maxHp;
        activeEnemy.minDmg = Math.floor(activeEnemy.minDmg * scaleMultiplier);
        activeEnemy.maxDmg = Math.floor(activeEnemy.maxDmg * scaleMultiplier);
        activeEnemy.xp = Math.floor(activeEnemy.xp * scaleMultiplier);
        activeEnemy.gold = Math.floor(activeEnemy.gold * scaleMultiplier);

        if (currentRoom === 50) { activeEnemy = { name: "Lich King", hp: 300, maxHp: 300, minDmg: 25, maxDmg: 50, xp: 360, gold: 200, sprite: "💀" }; logMsg("<b>BOSS ROOM! The Lich King approaches!</b>"); } 
        else if (currentRoom === 60) { activeEnemy = { name: "Lich God", hp: 400, maxHp: 400, minDmg: 35, maxDmg: 70, xp: 720, gold: 400, sprite: "💀" }; logMsg("<b>BOSS ROOM! The Lich God approaches!</b>"); } 
        else if (currentRoom === 70) { activeEnemy = { name: "Dragon King", hp: 600, maxHp: 600, minDmg: 55, maxDmg: 90, xp: 2000, gold: 800, sprite: "💀" }; logMsg("<b>BOSS ROOM! The Dragon King approaches!</b>"); } 
        else if (currentRoom === 80) { activeEnemy = { name: "Dragon God", hp: 800, maxHp: 800, minDmg: 70, maxDmg: 110, xp: 720, gold: 1200, sprite: "💀" }; logMsg("<b>BOSS ROOM! The Dragon God approaches!</b>"); } 
        else { logMsg(`A wild ${activeEnemy.name} appears!`); }

        getGameElement('enemy-sprite').innerText = activeEnemy.sprite;
        getGameElement('enemy-name').innerText = activeEnemy.name;
        getGameElement('enemy-sprite').style.display = 'flex';
        getGameElement('enemy-stats').style.display = 'block';
        
        getGameElement('btn-attack').style.display = 'block';
        getGameElement('btn-focus').style.display = 'block';
        getGameElement("btn-slow").style.display = 'block';
        getGameElement('btn-next-room').style.display = 'none';
        
        isPlayerTurn = true;
        currentFocusIndex = 0; // Reset index back to attack
        updateRPGUI();
    }

    function endCombat(victory) {
        if (victory) {
            hero.xp += activeEnemy.xp; hero.gold += activeEnemy.gold;
            logMsg(`<b>${activeEnemy.name} defeated!</b> Gained ${activeEnemy.xp} XP and ${activeEnemy.gold} Gold.`);
            
            checkLevelUp();
            activeEnemy = null; 
            getGameElement('enemy-sprite').style.display = 'none';
            getGameElement('enemy-stats').style.display = 'none';
            
            getGameElement('btn-attack').style.display = 'none';
            getGameElement('btn-focus').style.display = 'none';
            getGameElement("btn-slow").style.display = "none";
            currentFocusIndex = 0; // reset focus index
            updateRPGUI();
            
            if (currentRoom % 10 === 0 && currentRoom !== maxRooms) { showShop(); } 
            else { getGameElement('btn-next-room').style.display = 'block'; updateRPGUI(); }
        }
    }

    function restartDungeon() {
        hero = { hp: 50, maxHp: 50, focus: 3, maxFocus: 3, pots: 2, pots2: 2, pots3: 2, pots4: 0, pots5: 0, pots6: 0, minDmg: 5, maxDmg: 14, xp: 0, xpNeeded: 10, lvl: 1, gold: 0 };
        currentRoom = 1;
        const log = getGameElement('combat-log');
        if(log) log.innerHTML = "You enter the dark dungeon...";
        
        getGameElement('dungeon-game-over').style.display = 'none';
        getGameElement('shop-menu').style.display = 'none';
        getGameElement('action-menu').style.display = 'flex';
        spawnRoom();
        playBackgroundMusic();
    }

    // ==========================================
    // 🖱️ KEYBOARD & MOUSE CONTROLS BINDING
    // ==========================================
    function handleKeydown(e) {
        if (!userHasInteracted) unlockAudioContext(); // Unlock audio on first keypress
        
        // Don't process if no buttons are visible
        if (!visibleButtons.length) return;

        if (['ArrowRight', 'ArrowDown', 's', 'd', 'S', 'D'].includes(e.key)) {
            e.preventDefault(); // Stop window from scrolling down
            currentFocusIndex = (currentFocusIndex + 1) % visibleButtons.length;
            refreshKeyboardFocus();
        } 
        else if (['ArrowLeft', 'ArrowUp', 'w', 'a', 'W', 'A'].includes(e.key)) {
            e.preventDefault(); // Stop window from scrolling up
            currentFocusIndex = (currentFocusIndex - 1 + visibleButtons.length) % visibleButtons.length;
            refreshKeyboardFocus();
        } 
        else if (['Enter', ' ', 'Spacebar'].includes(e.key)) {
            e.preventDefault(); // Stop spacebar from scrolling down
            visibleButtons[currentFocusIndex].click();
        }
    }

    function bindControls() {
        const context = pipWindow ? pipWindow.document : document;
        injectKeyboardStyles(context);

        // Remove old listener to prevent doubling up when moving to PiP
        context.removeEventListener('keydown', handleKeydown);
        context.addEventListener('keydown', handleKeydown);

        const onClick = (id, callback) => {
            const btn = getGameElement(id);
            if (btn) btn.onclick = callback; 
        };

        // Combat actions
        onClick('btn-attack', () => executePlayerTurn(false, false));
        onClick('btn-slow', () => executePlayerTurn(false, true));
        onClick('btn-focus', () => executePlayerTurn(true, false));
        onClick('btn-next-room', () => { currentRoom++; spawnRoom(); });
        onClick('dungeon-restart-btn', restartDungeon);

        for (let i = 1; i <= 6; i++) { onClick(`btn-heal-${i}`, () => consumePotion(i)); }

        // Shop Purchases
        const buyLogic = (cost, potVar, name) => {
            if (hero.gold >= cost) { 
                hero.gold -= cost; hero[potVar]++; logMsg(`Bought ${name}.`); updateRPGUI(); 
                playSound('Sounds/Windows Shutdown.wav', 1.0);
            } else { logMsg("Not enough gold."); playSound('Sounds/Windows Default.wav', 1.0); }
        };

        onClick('btn-buy-pot', () => buyLogic(25, 'pots', 'Godsbeard'));
        onClick('btn-buy-pot2', () => buyLogic(35, 'pots2', 'Super Godsbeard'));
        onClick('btn-buy-pot3', () => buyLogic(60, 'pots3', 'Ultra Godsbeard'));
        onClick('btn-buy-pot4', () => { if (currentRoom > 14) buyLogic(100, 'pots4', 'Super Ultra Godsbeard'); else logMsg("Not available yet!"); });
        onClick('btn-buy-pot5', () => { if (currentRoom > 44) buyLogic(140, 'pots5', 'Super Supreme Ultra Godsbeard'); else logMsg("Not available yet!"); });
        onClick('btn-buy-pot6', () => { if (currentRoom > 44) buyLogic(190, 'pots6', 'Hyper Supreme Ultra Godsbeard'); else logMsg("Not available yet!"); });
        onClick('btn-buy-focus', () => {
            if (hero.gold >= 10 && hero.focus < hero.maxFocus) { hero.gold -= 10; hero.focus++; logMsg("Restored 1 Focus."); updateRPGUI(); } 
            else if (hero.focus >= hero.maxFocus) { logMsg("Focus is already full."); } 
            else { logMsg("Not enough gold."); playSound('Sounds/Windows Default.wav', 1.0); }
        });

        onClick('btn-leave-shop', () => {
            getGameElement('shop-menu').style.display = 'none';
            getGameElement('action-menu').style.display = 'flex';
            getGameElement('btn-next-room').style.display = 'block';
            currentFocusIndex = 0;
            updateRPGUI();
        });
    }

    // ==========================================
    // 📺 PICTURE-IN-PICTURE TOGGLE SYSTEM
    // ==========================================
    const pipToggleBtn = document.getElementById('pip-toggle-btn');
    const dungeonBoard = document.getElementById('dungeon-board');
    const dungeonView = document.getElementById('dungeon-view');

    if (pipToggleBtn && dungeonBoard) {
        pipToggleBtn.addEventListener('click', async () => {
            if (!('documentPictureInPicture' in window)) return alert('Your browser does not support PiP API.');
            if (pipWindow) { pipWindow.close(); return; }

            try {
                pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: dungeonBoard.clientWidth,
                    height: dungeonBoard.clientHeight + 20 
                });

                Array.from(document.styleSheets).forEach((styleSheet) => {
                    if (styleSheet.href) {
                        const link = pipWindow.document.createElement('link'); link.rel = 'stylesheet'; link.href = styleSheet.href;
                        pipWindow.document.head.appendChild(link);
                    } else {
                        try {
                            const style = pipWindow.document.createElement('style');
                            style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                            pipWindow.document.head.appendChild(style);
                        } catch (e) {}
                    }
                });

                pipWindow.document.body.append(dungeonBoard);
                
                // Unbind keys from the main document, and rebind to PiP window
                document.removeEventListener('keydown', handleKeydown);
                bindControls();
                updateRPGUI();

                pipWindow.addEventListener('pagehide', () => {
                    dungeonView.prepend(dungeonBoard);
                    pipWindow.document.removeEventListener('keydown', handleKeydown);
                    pipWindow = null; 
                    bindControls(); 
                    updateRPGUI();
                });

            } catch (error) { pipWindow = null; }
        });
    }

    // ==========================================
    // 🚀 INITIALIZATION
    // ==========================================
    bindControls();
    restartDungeon();
});