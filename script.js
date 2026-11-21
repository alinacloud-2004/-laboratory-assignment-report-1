(function () {
    'use strict';

    /* ============================================================
       Конфигурация калькулятора (тематика: грузоперевозка)
       ============================================================ */
    const TARIFF_PER_KM = 25;      // руб. за км
    const TARIFF_PER_KG = 8;       // руб. за кг
    const TARIFF_PER_M3 = 120;     // руб. за м³
    const STORAGE_KEY = 'cargo_calc_journal_v1';

    /* ============================================================
       Тексты ошибок (4 разных случая) — прикольные фразы
       ============================================================ */
    const ERROR_EMPTY = 'Эй, поле пустое! Даже пустой грузовик без водителя не поедет — заполни, пожалуйста.';
    const ERROR_NOT_NUMBER = 'Это что, буквы? Мы грузы возим, а не стихи сочиняем. Введи-ка число!';
    const ERROR_ZERO = 'Ноль? Перевозить воздух за ноль рублей — это благотворительность, а мы бизнес. Введи больше нуля!';
    const ERROR_NEGATIVE = 'Отрицательный вес? Ты что, антиматерию перевозишь? Такого даже наши грузовики не выдержат — введи положительное число!';

    /* ============================================================
       DOM-элементы
       ============================================================ */
    const form = document.getElementById('calc-form');
    const distanceInput = document.getElementById('distance');
    const weightInput = document.getElementById('weight');
    const volumeInput = document.getElementById('volume');
    const errorBox = document.getElementById('error-box');
    const resultBox = document.getElementById('result-box');
    const journalList = document.getElementById('journal-list');
    const journalEmpty = document.getElementById('journal-empty');
    const clearBtn = document.getElementById('clear-journal');

    const inputs = [
        { el: distanceInput, label: 'Расстояние (км)' },
        { el: weightInput, label: 'Вес груза (кг)' },
        { el: volumeInput, label: 'Объём груза (м³)' }
    ];

    /* ============================================================
       Работа с журналом (localStorage)
       ============================================================ */
    function loadJournal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveJournal(entries) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (e) {
            /* localStorage может быть недоступен (приватный режим) — молча игнорируем */
        }
    }

    function formatDateTime(iso) {
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function renderJournal() {
        const entries = loadJournal();
        journalList.innerHTML = '';

        if (entries.length === 0) {
            journalEmpty.classList.remove('hidden');
            return;
        }
        journalEmpty.classList.add('hidden');

        entries.forEach((entry) => {
            const li = document.createElement('li');

            const time = document.createElement('span');
            time.className = 'journal-time';
            time.textContent = formatDateTime(entry.time);

            const data = document.createElement('span');
            data.textContent = `Расстояние: ${entry.distance} км · Вес: ${entry.weight} кг · Объём: ${entry.volume} м³ → `;

            const result = document.createElement('span');
            result.className = 'journal-result';
            result.textContent = `${entry.total.toFixed(2)} ₽`;

            li.appendChild(time);
            li.appendChild(data);
            li.appendChild(result);
            journalList.appendChild(li);
        });
    }

    function addJournalEntry(entry) {
        const entries = loadJournal();
        entries.push(entry);            // добавляем в КОНЕЦ списка
        saveJournal(entries);
        renderJournal();                // перерисовываем (старые записи сохраняются)
    }

    function clearJournal() {
        saveJournal([]);
        renderJournal();
    }

    /* ============================================================
       Валидация одного поля
       Возвращает { ok: boolean, value: number, message: string }
       ============================================================ */
    function validateField(rawValue, fieldLabel) {
        const trimmed = rawValue.trim();

        // 1) Пустое поле
        if (trimmed === '') {
            return { ok: false, value: NaN, message: `${fieldLabel}: ${ERROR_EMPTY}` };
        }

        // 2) Не число (буквы, символы)
        const normalized = trimmed.replace(',', '.');
        if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
            return { ok: false, value: NaN, message: `${fieldLabel}: ${ERROR_NOT_NUMBER}` };
        }

        const num = parseFloat(normalized);

        // 3) Ровно ноль
        if (num === 0) {
            return { ok: false, value: 0, message: `${fieldLabel}: ${ERROR_ZERO}` };
        }

        // 4) Отрицательное число
        if (num < 0) {
            return { ok: false, value: num, message: `${fieldLabel}: ${ERROR_NEGATIVE}` };
        }

        return { ok: true, value: num, message: '' };
    }

    /* ============================================================
       Отображение ошибки
       ============================================================ */
    function showError(message) {
        errorBox.textContent = message;
        errorBox.classList.add('visible');
    }

    function hideError() {
        errorBox.textContent = '';
        errorBox.classList.remove('visible');
    }

    function resetFieldStyles() {
        inputs.forEach(({ el }) => el.classList.remove('invalid'));
    }

    /* ============================================================
       Основной расчёт
       ============================================================ */
    function calculate() {
        hideError();
        resetFieldStyles();
        resultBox.classList.remove('visible');
        resultBox.innerHTML = '';

        const values = {};
        let firstError = null;
        let firstErrorEl = null;

        for (const { el, label } of inputs) {
            const res = validateField(el.value, label);

            if (!res.ok) {
                el.classList.add('invalid');
                if (!firstError) {
                    firstError = res.message;
                    firstErrorEl = el;
                }
            } else {
                values[el.id] = res.value;
            }
        }

        if (firstError) {
            showError(firstError);
            if (firstErrorEl) firstErrorEl.focus();
            return;
        }

        // Расчёт стоимости
        const total =
            values.distance * TARIFF_PER_KM +
            values.weight * TARIFF_PER_KG +
            values.volume * TARIFF_PER_M3;

        // Вывод результата
        resultBox.innerHTML =
            `Итоговая стоимость: ${total.toFixed(2)} ₽` +
            `<span class="result-detail">Расстояние: ${values.distance} км · Вес: ${values.weight} кг · Объём: ${values.volume} м³</span>`;
        resultBox.classList.add('visible');

        // Запись в журнал
        addJournalEntry({
            time: new Date().toISOString(),
            distance: values.distance,
            weight: values.weight,
            volume: values.volume,
            total: total
        });
    }

    /* ============================================================
       Обработчики событий
       ============================================================ */
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        calculate();
    });

    inputs.forEach(({ el }) => {
        el.addEventListener('input', function () {
            el.classList.remove('invalid');
        });
    });

    clearBtn.addEventListener('click', function () {
        clearJournal();
    });

    /* ============================================================
       Инициализация
       ============================================================ */
    renderJournal();
})();
