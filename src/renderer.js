window.addEventListener('DOMContentLoaded', () => {
    const SLIDE_GAP = 24;
    let currentTab = 0;
    const tabs = document.querySelectorAll('.tab');
    const indicator = document.querySelector('.tab-indicator');
    const container = document.querySelector('.form-container');
    const wrapper = document.querySelector('.forms-wrapper');
    const formWrap = document.querySelector('.form-wrapper');

    // Form elemanları
    const loginUser = document.getElementById('login-username');
    const loginPass = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const regUser = document.getElementById('register-username');
    const regPass1 = document.getElementById('register-password');
    const regPass2 = document.getElementById('register-confirm');
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
        currentTab = i; // pencere boyutlanınca lazım
        tabs.forEach((t) => t.classList.remove('active'));
        tabs[i].classList.add('active');
        indicator.style.left = `${i * 50}%`;

        //  Kaydırma mesafesi  =  -(sekmeNo) × (formGenişliği + GAP)
        const slideWidth = container.clientWidth; // anlık genişlik
        const offset = -i * (slideWidth + SLIDE_GAP);
        wrapper.style.transform = `translateX(${offset}px)`;
    }
    tabs.forEach((t, i) => t.addEventListener('click', () => activate(i)));
    activate(0);

    window.addEventListener('resize', () => activate(currentTab));

    // Form geçerlilik kontrolleri
    function checkLoginValid() {
        loginBtn.disabled = !(loginUser.value.trim() && loginPass.value.trim());
    }
    loginUser.addEventListener('input', checkLoginValid);
    loginPass.addEventListener('input', checkLoginValid);

    function checkRegisterValid() {
        const filled = regUser.value.trim() && regPass1.value.trim() && regPass2.value.trim();
        const match = regPass1.value === regPass2.value;
        if (regPass2.value) regPass2.classList.toggle('error', !match);
        regBtn.disabled = !(filled && match);
    }
    regUser.addEventListener('input', checkRegisterValid);
    regPass1.addEventListener('input', checkRegisterValid);
    regPass2.addEventListener('input', checkRegisterValid);

    function fakeAuth(type) {
        return new Promise((res) => {
            setTimeout(() => {
                if (type === 'login') res(false);
                else res(regUser.value !== 'hata');
            }, 600);
        });
    }

    // Feedback ikonunu gösterme helper’ı
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
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginBtn.disabled = true;
        const payload = `LOGIN:${loginUser.value}:${loginPass.value}`;
        let success;
        try {
            success = await window.card.request(payload);
        } catch (err) {
            console.error('Kart iletişim hatası:', err);
            success = false;
        }
        showFeedback(success);
    });

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        regBtn.disabled = true;
        const payload = `REGISTER:${regUser.value}:${regPass1.value}`;
        let success;
        try {
            success = await window.card.request(payload);
        } catch (err) {
            console.error('Kart iletişim hatası:', err);
            success = false;
        }
        showFeedback(success);
    });
});
