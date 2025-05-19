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
    const alg1 = document.getElementById('alg1');
    const alg2 = document.getElementById('alg2');
    const regBtn = document.getElementById('register-btn');

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
        // Algoritmalar mutual-exclusive: tam olarak bir tanesi seçili olmalı
        const algOk = (alg1.checked && !alg2.checked) || (alg2.checked && !alg1.checked);
        regBtn.disabled = !(nameOk && algOk);
    }
    regUser.addEventListener('input', checkRegisterValid);
    alg1.addEventListener('change', () => {
        if (alg1.checked) alg2.checked = false;
        checkRegisterValid();
    });
    alg2.addEventListener('change', () => {
        if (alg2.checked) alg1.checked = false;
        checkRegisterValid();
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

    //<svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/><path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/></svg>
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        isProcessing = true; // İşlem başladı

        // Tüm form elemanlarını devre dışı bırak
        regBtn.disabled = true;
        regUser.disabled = true;
        alg1.disabled = true;
        alg2.disabled = true;

        const algorithm = alg1.checked ? '1' : '2';
        const payload = `REGISTER:${regUser.value}:${algorithm}`;
        let success;
        try {
            success = await window.card.request(payload);
        } catch (err) {
            console.error('Kart iletişim hatası:', err);
            success = false;
        }

        // İşlem başarısız olursa form elemanlarını tekrar aktif et
        if (!success) {
            regUser.disabled = false;
            alg1.disabled = false;
            alg2.disabled = false;
            regBtn.disabled = false;
            isProcessing = false; // İşlem bitti
        }
        showFeedback(success);
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        isProcessing = true; // İşlem başladı

        loginBtn.disabled = true;
        loginUser.disabled = true;

        const payload = `LOGIN:${loginUser.value}`;
        let success;
        try {
            success = await window.card.request(payload);
        } catch (err) {
            console.error('Kart iletişim hatası:', err);
            success = false;
        }

        if (!success) {
            loginUser.disabled = false;
            loginBtn.disabled = false;
            isProcessing = false; // İşlem bitti
        }
        showFeedback(success);
    });
});
