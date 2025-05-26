window.addEventListener('DOMContentLoaded', () => {
    const SLIDE_GAP = 24;
    let currentTab = 0;
    let isProcessing = false; // İşlem durumunu takip etmek için
    const tabs = document.querySelectorAll('.tab');
    const indicator = document.querySelector('.tab-indicator');
    const container = document.querySelector('.form-container');
    const wrapper = document.querySelector('.forms-wrapper');
    const formWrap = document.querySelector('.form-wrapper');

    // Form elemanları
    const loginUser = document.getElementById('login-username');
    const loginBtn = document.getElementById('login-btn');
    const regUser = document.getElementById('register-username');
    const toggleOptions = document.querySelectorAll('.toggle-option');
    const regBtn = document.getElementById('register-btn');
    const statusDisplay = document.getElementById('status-display');
    
    // Python betiğindeki statik değerler
    const PY_RP_ID = 'example.com';
    const PY_RP_NAME = 'Example';
    // Diğer PY_USER_ sabitleri artık doğrudan kullanılmayacak, kullanıcı girdisinden türetilecek.

    let selectedCoseAlgorithm = -5; // Varsayılan LMS (-5)

    // Yatay slide ve yükseklik ayarı
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');
    wrapper.style.transform = `translateX(0)`;
    const connectMessage = document.getElementById('connectMessage');
    const formWrapper = document.querySelector('.form-wrapper');

    connectMessage.classList.remove('hidden');
    formWrapper.classList.add('hidden');

    if (window.initialCardPresent) {
        connectMessage.classList.add('hidden');
        formWrapper.classList.remove('hidden');
        setFormContainerHeight();
    } else {
        connectMessage.classList.remove('hidden');
        formWrapper.classList.add('hidden');
    }

    window.card.onCardConnected(() => {
        connectMessage.classList.add('hidden');
        formWrapper.classList.remove('hidden');
        setFormContainerHeight();
    });

    window.card.onCardDisconnected(() => {
        formWrapper.classList.add('hidden');
        connectMessage.textContent = 'Kart çıkarıldı. Lütfen kartı takınız.';
        connectMessage.classList.remove('hidden');
        container.style.height = '0px';
    });

    function setFormContainerHeight() {
        const H = Math.max(loginForm.offsetHeight, regForm.offsetHeight);
        container.style.height = `${H}px`;
    }

    function activate(i) {
        if (isProcessing) return; // İşlem devam ediyorsa tab değişimine izin verme
        currentTab = i;
        tabs.forEach((t) => t.classList.remove('active'));
        tabs[i].classList.add('active');
        indicator.style.left = `${i * 50}%`;

        const slideWidth = container.clientWidth;
        const offset = -i * (slideWidth + SLIDE_GAP);
        wrapper.style.transform = `translateX(${offset}px)`;
    }
    tabs.forEach((t, i) => t.addEventListener('click', () => activate(i)));
    activate(0);

    window.addEventListener('resize', () => activate(currentTab));

    // Form geçerlilik kontrolleri
    function checkLoginValid() {
        loginBtn.disabled = loginUser.value.trim() === ''; 
    }
    loginUser.addEventListener('input', checkLoginValid);

    function checkRegisterValid() {
        const nameOk = regUser.value.trim() !== '';
        const algOk = document.querySelector('.toggle-option.active') !== null;
        regBtn.disabled = !(nameOk && algOk);
    }
    regUser.addEventListener('input', checkRegisterValid);
    
    // Toggle switch event listeners
    const algorithmToggle = document.querySelector('.algorithm-toggle');
    const animatedStroke = document.querySelector('.animated-stroke');
    const animatedStroke2 = document.querySelector('.animated-stroke-2');
    
    // Sol ve Sağ yarım path tanımları (dış çerçeveyi takip eden)
    // ViewBox 200x50, stroke-width=1.5
    // Sol yarı: U şeklinde tek sürekli path - sol üst köşeden başlayıp sol yarımın çerçevesini çizer
    const pathLeft = "M100 1 L8 1 A7 7 0 0 0 1 8 L1 42 A7 7 0 0 0 8 49 L100 49";
    // Sağ yarı: Sağ üst köşeden başlar, sağ kenarı, sağ alt köşeyi ve alt kenarın yarısını çizer.
    const pathRight = "M100 1 L192 1 A7 7 0 0 1 199 8 L199 42 A7 7 0 0 1 192 49 L100 49";
    
    // Sağdan sola geçiş için alternatif path'ler (aşağıdan geçen)
    // Sol yarı: aşağıdan başlayıp yukarı çıkan
    const pathLeftFromBottom = "M100 49 L8 49 A7 7 0 0 1 1 42 L1 8 A7 7 0 0 1 8 1 L100 1";
    // Sağ yarı: aşağıdan başlayıp yukarı çıkan  
    const pathRightFromBottom = "M100 49 L192 49 A7 7 0 0 0 199 42 L199 8 A7 7 0 0 0 192 1 L100 1";

    // İki path elementini başlat
    animatedStroke.setAttribute('d', pathLeft);
    animatedStroke2.setAttribute('d', pathRight);
    
    let leftPathLength = animatedStroke.getTotalLength();
    let rightPathLength = animatedStroke2.getTotalLength();
    
    // Sol path başlangıçta görünür, sağ path gizli
    animatedStroke.style.strokeDasharray = leftPathLength + ' ' + leftPathLength;
    animatedStroke.style.strokeDashoffset = '0';
    animatedStroke2.style.strokeDasharray = rightPathLength + ' ' + rightPathLength;
    animatedStroke2.style.strokeDashoffset = String(rightPathLength);

    let isAnimating = false;
    const animationDuration = 500; // CSS transition süresiyle eşleşmeli

    function switchToLeft() {
        if (isAnimating) return;
        isAnimating = true;

        // Sağdan sola geçiş: aşağıdan geçen path'leri kullan
        // Önce path'leri değiştir
        animatedStroke.setAttribute('d', pathLeftFromBottom);
        animatedStroke2.setAttribute('d', pathRightFromBottom);
        
        // Yeni uzunlukları hesapla
        let newLeftLength = animatedStroke.getTotalLength();
        let newRightLength = animatedStroke2.getTotalLength();
        
        // Dash array'leri güncelle
        animatedStroke.style.strokeDasharray = newLeftLength + ' ' + newLeftLength;
        animatedStroke2.style.strokeDasharray = newRightLength + ' ' + newRightLength;
        
        // Başlangıç pozisyonları: sağ görünür, sol gizli
        animatedStroke.style.strokeDashoffset = String(newLeftLength);
        animatedStroke2.style.strokeDashoffset = '0';
        
        // Kısa gecikmeyle animasyonu başlat
        requestAnimationFrame(() => {
            // Sağ path'i sil, sol path'i çiz (eşzamanlı)
            animatedStroke2.style.strokeDashoffset = String(newRightLength); // Sağ gizle
            animatedStroke.style.strokeDashoffset = '0'; // Sol göster
        });

        setTimeout(() => {
            // Animasyon bitince normal path'lere geri dön
            animatedStroke.setAttribute('d', pathLeft);
            animatedStroke2.setAttribute('d', pathRight);
            
            leftPathLength = animatedStroke.getTotalLength();
            rightPathLength = animatedStroke2.getTotalLength();
            
            animatedStroke.style.strokeDasharray = leftPathLength + ' ' + leftPathLength;
            animatedStroke2.style.strokeDasharray = rightPathLength + ' ' + rightPathLength;
            animatedStroke.style.strokeDashoffset = '0';
            animatedStroke2.style.strokeDashoffset = String(rightPathLength);
            
            isAnimating = false;
        }, animationDuration + 50);
    }

    function switchToRight() {
        if (isAnimating) return;
        isAnimating = true;

        // Soldan sağa geçiş: normal path'leri kullan (yukarıdan geçer)
        // Path'ler zaten doğru, sadece animasyonu başlat
        requestAnimationFrame(() => {
            // Sol path'i sil, sağ path'i çiz (eşzamanlı)
            animatedStroke.style.strokeDashoffset = String(leftPathLength); // Sol gizle
            animatedStroke2.style.strokeDashoffset = '0'; // Sağ göster
        });

        setTimeout(() => {
            isAnimating = false;
        }, animationDuration + 50);
    }

    toggleOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (isAnimating) return;
            
            toggleOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            const isRight = option.dataset.algorithm === '2'; // XMSS
            selectedCoseAlgorithm = isRight ? -6 : -5; // XMSS: -6, LMS: -5
            console.log("Selected COSE Algorithm:", selectedCoseAlgorithm);

            if (algorithmToggle.classList.contains('right-selected') === isRight) {
                return;
            }

            if (isRight) {
                algorithmToggle.classList.add('right-selected');
                switchToRight();
            } else {
                algorithmToggle.classList.remove('right-selected');
                switchToLeft();
            }
            checkRegisterValid();
        });
    });

    function fakeAuth(type) {
        return new Promise((res) => {
            setTimeout(() => {
                if (type === 'login') res(false);
                else res(regUser.value !== 'hata');
            }, 600);
        });
    }

    // Feedback ikonunu gösterme helper'ı
    function showFeedbackIcon(svgMarkup, callback) {
        const overlay = document.createElement('div');
        overlay.className = 'feedback-overlay';
        overlay.innerHTML = svgMarkup;
        document.body.appendChild(overlay);

        const icon = overlay.querySelector('svg');
        icon.classList.add('feedback-icon');

        icon.addEventListener(
            'animationend',
            function onIn(e) {
                if (e.animationName !== 'fadeInIcon') return;
                icon.removeEventListener('animationend', onIn);
                setTimeout(() => {
                    icon.classList.add('fade-out-icon');
                    icon.addEventListener(
                        'animationend',
                        function onOut(ev) {
                            if (ev.animationName !== 'fadeOutIcon') return;
                            icon.removeEventListener('animationend', onOut);
                            document.body.removeChild(overlay);
                            if (callback) callback();
                        },
                        { once: true }
                    );
                }, 1000);
            },
            { once: true }
        );
    }

    function showFeedback(success) {
        formWrap.classList.add('fade-out-form');
        formWrap.addEventListener('animationend', onFormFadeOut, { once: true });

        function onFormFadeOut(e) {
            if (e.animationName !== 'fadeOutForm') return;
            formWrap.classList.remove('fade-out-form');
            formWrap.style.display = 'none';

            const overlay = document.createElement('div');
            overlay.className = 'feedback-overlay';
            const svgMarkup = success
                ? `
        <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="checkmark__check" fill="none"
                d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>`
                : `
        <svg class="crossmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle class="crossmark__circle" cx="26" cy="26" r="25" fill="none"/>
          <path class="crossmark__cross" fill="none"
                d="M16 16 L36 36 M36 16 L16 36"/>
        </svg>`;
            overlay.innerHTML = svgMarkup;
            document.body.appendChild(overlay);

            const pathSel = success ? '.checkmark__check' : '.crossmark__cross';
            const strokePath = overlay.querySelector(pathSel);
            strokePath.addEventListener('animationend', onStrokeEnd, { once: true });

            function onStrokeEnd(ev) {
                if (ev.animationName !== 'stroke') return;

                if (success) {
                    // SVG ortada kalsın
                    return;
                }

                setTimeout(() => {
                    overlay.classList.add('fade-out-overlay');
                    overlay.addEventListener('animationend', onOverlayFade, { once: true });
                }, 1000);
            }

            function onOverlayFade(e2) {
                if (e2.animationName !== 'fadeOutOverlay') return;
                overlay.remove();

                formWrap.style.display = '';
                formWrap.classList.add('fade-in-form');
                formWrap.addEventListener('animationend', onFormFadeIn, { once: true });
            }

            function onFormFadeIn(e3) {
                if (e3.animationName !== 'fadeInForm') return;
                formWrap.classList.remove('fade-in-form');
                loginBtn.disabled = false;
            }
        }
    }

    function showStatus(message, isError = false) {
        if (statusDisplay) {
            statusDisplay.textContent = message;
            statusDisplay.className = isError ? 'status-error' : 'status-success';
            // Kısa bir süre sonra mesajı temizle
            setTimeout(() => {
                statusDisplay.textContent = '';
                statusDisplay.className = '';
            }, isError ? 6000 : 4000);
        }
        console.log(isError ? "Error:" : "Success:", message);
    }

    // Helper to generate a random challenge
    function generateChallenge() {
        const challengeArray = new Uint8Array(32); // 32 byte challenge
        window.crypto.getRandomValues(challengeArray);
        // Base64URL encode
        return btoa(String.fromCharCode.apply(null, challengeArray))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    // SHA-256 hash helper (async)
    async function sha256(message) {
        // encode as UTF-8
        const msgBuffer = new TextEncoder().encode(message);
        // hash the message
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        // convert ArrayBuffer to Array
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        // convert bytes to hex string
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    loginBtn.addEventListener('click', async () => {
        if (isProcessing || loginBtn.disabled) return;
        isProcessing = true;
        loginBtn.classList.add('processing');
        tabs.forEach(t => t.style.pointerEvents = 'none');
        formWrap.classList.add('form-disabled');

        try {
            const challenge = generateChallenge();
            const requestPayload = {
                operation: 'getAssertion',
                data: {
                    rpId: PY_RP_ID, 
                    challenge: challenge,
                    type: "webauthn.get",
                }
            };
            console.log("Sending GetAssertion request:", JSON.stringify(requestPayload, null, 2));
            const result = await window.card.request(requestPayload);
            console.log('GetAssertion Sonucu (Raw CBOR Decoded):', result);
            showStatus(`Kimlik doğrulama denemesi yapıldı. Yanıt için konsolu kontrol edin.`);
        } catch (error) {
            console.error('GetAssertion Hatası:', error);
            showStatus(`Kimlik doğrulama hatası: ${error.message}`, true);
        } finally {
            isProcessing = false;
            loginBtn.classList.remove('processing');
            tabs.forEach(t => t.style.pointerEvents = 'auto');
            formWrap.classList.remove('form-disabled');
            checkLoginValid();
        }
    });

    regBtn.addEventListener('click', async () => {
        if (isProcessing || regBtn.disabled) return;
        isProcessing = true;
        regBtn.classList.add('processing');
        tabs.forEach(t => t.style.pointerEvents = 'none');
        formWrap.classList.add('form-disabled');

        try {
            const challenge = generateChallenge();
            const rawUsername = regUser.value.trim();

            if (!rawUsername) {
                showStatus("Kullanıcı adı boş olamaz!", true);
                return; // Fonksiyondan erken çık
            }

            // userId: Kullanıcı adının SHA-256 hash'i (hex string)
            const userIdHex = await sha256(rawUsername);
            
            // userName: Kullanıcıdan alınan ham kullanıcı adı
            const userName = rawUsername;
            
            // userDisplayName: @ varsa öncesi, yoksa tamamı
            let userDisplayName = rawUsername;
            const atSignIndex = rawUsername.indexOf('@');
            if (atSignIndex > 0) {
                userDisplayName = rawUsername.substring(0, atSignIndex);
            }

            const requestPayload = {
                operation: 'makeCredential',
                data: {
                    rpId: PY_RP_ID,     // Sabit RP ID
                    rpName: PY_RP_NAME,   // Sabit RP Adı
                    userId: userIdHex,         // Kullanıcı adının SHA-256 hash'i (hex string)
                    userName: userName,          // Kullanıcıdan alınan ham kullanıcı adı
                    userDisplayName: userDisplayName,  // Türetilmiş display name
                    challenge: challenge,
                    type: "webauthn.create",
                    pubKeyCredParams: [{ type: 'public-key', alg: selectedCoseAlgorithm }], 
                }
            };
            console.log("Sending MakeCredential request:", JSON.stringify(requestPayload, null, 2));
            const result = await window.card.request(requestPayload);
            console.log('MakeCredential Sonucu (Raw CBOR Decoded):', result);
            showStatus(`Kayıt denemesi yapıldı. Yanıt için konsolu kontrol edin.`);
            
        } catch (error) {
            console.error('MakeCredential Hatası:', error);
            showStatus(`Kayıt hatası: ${error.message}`, true);
        } finally {
            
            if(isProcessing){ // Sadece işlem gerçekten başladıysa false yap
                isProcessing = false;
                regBtn.classList.remove('processing');
                tabs.forEach(t => t.style.pointerEvents = 'auto');
                formWrap.classList.remove('form-disabled');
                checkRegisterValid();
            }
        }
    });
});
