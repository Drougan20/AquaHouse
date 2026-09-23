type Availability = {
  blockedDates: string[];
  checkedAt: string;
};

type Quote = {
  nights: number;
  total: number;
  currency: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing calendar element: ${id}`);
  return found as T;
}

function todayInSouthAfrica(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function setupCalendar(): void {
  if (!document.getElementById('availability')) return;

  const monthLabel = element<HTMLElement>('booking-month');
  const daysContainer = element<HTMLDivElement>('booking-days');
  const previousButton = element<HTMLButtonElement>('booking-previous');
  const nextButton = element<HTMLButtonElement>('booking-next');
  const refreshButton = element<HTMLButtonElement>('booking-refresh');
  const inquireButton = element<HTMLButtonElement>('booking-inquire');
  const checkInButton = element<HTMLButtonElement>('booking-check-in-button');
  const checkOutButton = element<HTMLButtonElement>('booking-check-out-button');
  const viewCalendarButton = element<HTMLButtonElement>('booking-view-calendar');
  const picker = element<HTMLElement>('booking-picker');
  const popover = element<HTMLDivElement>('booking-calendar-popover');
  const status = element<HTMLElement>('booking-status');
  const quoteStatus = element<HTMLElement>('booking-quote-status');
  const checkInLabel = element<HTMLElement>('booking-check-in');
  const checkOutLabel = element<HTMLElement>('booking-check-out');
  const totalLabel = element<HTMLElement>('booking-total');
  const nightsLabel = element<HTMLElement>('booking-nights');
  const form = element<HTMLFormElement>('booking-form');
  const formStatus = element<HTMLElement>('booking-form-status');
  const emailInput = element<HTMLInputElement>('booking-email');
  const phoneInput = element<HTMLInputElement>('booking-phone');
  const messageInput = element<HTMLTextAreaElement>('booking-message');
  const sendButton = element<HTMLButtonElement>('booking-send');

  const monthPair = document.createElement('div');
  monthPair.className = 'booking-month-pair';

  const firstPanel = document.createElement('section');
  firstPanel.className = 'booking-month-panel';

  const secondPanel = document.createElement('section');
  secondPanel.className = 'booking-month-panel';

  const firstTitle = document.createElement('h3');
  firstTitle.className = 'booking-month-title';

  const secondTitle = document.createElement('h3');
  secondTitle.className = 'booking-month-title';

  const nextDaysContainer = daysContainer.cloneNode(false) as HTMLDivElement;
  nextDaysContainer.id = 'booking-days-next';

  daysContainer.before(monthPair);
  monthPair.append(firstPanel, secondPanel);
  firstPanel.append(firstTitle, daysContainer);
  secondPanel.append(secondTitle, nextDaysContainer);

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.id = 'booking-reset';
  resetButton.className = 'booking-reset';
  resetButton.textContent = 'Reset dates';
  inquireButton.before(resetButton);

  const today = todayInSouthAfrica();
  const latestCheckout = new Date(
    Date.parse(`${today}T00:00:00Z`) + 365 * DAY_MS,
  )
    .toISOString()
    .slice(0, 10);

  let visibleMonth = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1),
  );

  let blocked = new Set<string>();
  let calendarReady = false;
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  let quoteRequest = 0;
  let pickerMode: 'check-in' | 'check-out' = 'check-in';
  let openingButton: HTMLButtonElement = viewCalendarButton;

  function hasBlockedNight(start: string, end: string): boolean {
    return [...blocked].some((date) => date >= start && date < end);
  }

  function clearQuote(): void {
    quoteRequest++;
    totalLabel.textContent = 'Choose your dates';
    quoteStatus.textContent = '';
    inquireButton.disabled = true;
    form.hidden = true;
    formStatus.textContent = '';
    sendButton.disabled = false;
  }

  function showSelectedDates(): void {
    checkInLabel.textContent = checkIn ? displayDate(checkIn) : 'Choose date';
    checkOutLabel.textContent = checkOut ? displayDate(checkOut) : 'Choose date';

    const nights =
      checkIn && checkOut
        ? Math.round(
            (Date.parse(`${checkOut}T00:00:00Z`) -
              Date.parse(`${checkIn}T00:00:00Z`)) /
              DAY_MS,
          )
        : 0;

    nightsLabel.textContent = nights
      ? `${nights} ${nights === 1 ? 'night' : 'nights'}`
      : checkIn
        ? 'Choose check-out'
        : 'Select dates';

    resetButton.disabled = !checkIn && !checkOut;
  }

  function updatePickerButtons(): void {
    checkInButton.classList.toggle(
      'is-active',
      !popover.hidden && pickerMode === 'check-in',
    );

    checkOutButton.classList.toggle(
      'is-active',
      !popover.hidden && pickerMode === 'check-out',
    );

    viewCalendarButton.textContent = popover.hidden
      ? 'View calendar'
      : 'Close calendar';

    for (const button of [
      checkInButton,
      checkOutButton,
      viewCalendarButton,
    ]) {
      button.setAttribute(
        'aria-expanded',
        String(!popover.hidden && button === openingButton),
      );
    }
  }

  function openCalendar(
    mode: 'check-in' | 'check-out',
    button: HTMLButtonElement,
  ): void {
    pickerMode = mode === 'check-out' && !checkIn ? 'check-in' : mode;
    openingButton = button;
    popover.hidden = false;
    updatePickerButtons();

    quoteStatus.textContent =
      pickerMode === 'check-in'
        ? 'Choose your check-in date.'
        : 'Choose a check-out date after your check-in.';

    drawCalendar();
  }

  function closeCalendar(): void {
    popover.hidden = true;
    updatePickerButtons();
  }

  function monthName(date: Date): string {
    return new Intl.DateTimeFormat('en-ZA', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  function drawMonth(monthStart: Date, container: HTMLDivElement): void {
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const blanks = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const fragment = document.createDocumentFragment();

    for (const weekday of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      const heading = document.createElement('span');
      heading.className = 'booking-weekday';
      heading.textContent = weekday;
      fragment.append(heading);
    }

    for (let i = 0; i < blanks; i++) {
      const blank = document.createElement('span');
      blank.className = 'booking-empty';
      blank.setAttribute('aria-hidden', 'true');
      fragment.append(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = [
        year,
        String(month + 1).padStart(2, '0'),
        String(day).padStart(2, '0'),
      ].join('-');

      const isBlocked = blocked.has(date);
      const canFinish =
        checkIn !== null &&
        date > checkIn &&
        !hasBlockedNight(checkIn, date);

      const canCheckoutOnBlocked =
        pickerMode === 'check-out' && isBlocked && canFinish;

      const canStart = !isBlocked && date < latestCheckout;

      const canPick =
        calendarReady &&
        date >= today &&
        date <= latestCheckout &&
        (pickerMode === 'check-in' ? canStart : canFinish);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'booking-day';
      button.textContent = String(day);
      button.dataset.date = date;
      button.disabled = !canPick;

      const description =
        date < today
          ? 'past date, unavailable'
          : isBlocked
            ? canCheckoutOnBlocked
              ? 'booked night; available as check-out date'
              : 'booked, unavailable'
            : date > latestCheckout || (date === latestCheckout && !canFinish)
              ? 'outside booking window'
              : pickerMode === 'check-out' && checkIn && date <= checkIn
                ? 'before check-in'
                : pickerMode === 'check-out' && !canFinish
                  ? 'unavailable for the selected stay'
                  : date === checkIn
                    ? 'selected check-in'
                    : date === checkOut
                      ? 'selected check-out'
                      : 'available';

      button.setAttribute('aria-label', `${displayDate(date)}: ${description}`);

      if (date < today) button.classList.add('is-past');
      if (isBlocked) button.classList.add('is-blocked');
      if (canCheckoutOnBlocked) button.classList.add('is-checkout-only');

      if (date === checkIn || date === checkOut) {
        button.classList.add('is-selected');
        button.setAttribute('aria-pressed', 'true');
      }

      if (checkIn && checkOut && date > checkIn && date < checkOut) {
        button.classList.add('is-between');
      }

      fragment.append(button);
    }

    container.replaceChildren(fragment);
  }

  function drawCalendar(): void {
    const followingMonth = new Date(
      Date.UTC(
        visibleMonth.getUTCFullYear(),
        visibleMonth.getUTCMonth() + 1,
        1,
      ),
    );

    const firstName = monthName(visibleMonth);
    const secondName = monthName(followingMonth);

    const currentMonthNumber =
      visibleMonth.getUTCFullYear() * 12 + visibleMonth.getUTCMonth();

    const firstMonthNumber =
      Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;

    const lastMonthNumber =
      Number(latestCheckout.slice(0, 4)) * 12 +
      Number(latestCheckout.slice(5, 7)) -
      1;

    const showSecond = currentMonthNumber + 1 <= lastMonthNumber;

    monthLabel.textContent = showSecond
      ? `${firstName} – ${secondName}`
      : firstName;

    firstTitle.textContent = firstName;
    secondTitle.textContent = secondName;
    secondPanel.hidden = !showSecond;
    monthPair.classList.toggle('has-one-month', !showSecond);

    drawMonth(visibleMonth, daysContainer);

    if (showSecond) {
      drawMonth(followingMonth, nextDaysContainer);
    } else {
      nextDaysContainer.replaceChildren();
    }

    previousButton.disabled = currentMonthNumber <= firstMonthNumber;
    nextButton.disabled = currentMonthNumber + 1 >= lastMonthNumber;
  }

  async function requestQuote(): Promise<void> {
    if (!checkIn || !checkOut) return;

    const selectedIn = checkIn;
    const selectedOut = checkOut;
    const request = ++quoteRequest;

    inquireButton.disabled = true;
    totalLabel.textContent = 'Calculating…';
    quoteStatus.textContent = 'Checking your dates and price…';

    try {
      const params = new URLSearchParams({
        checkIn: selectedIn,
        checkOut: selectedOut,
      });

      const response = await fetch(`/api/quote?${params}`, {
        cache: 'no-store',
      });

      const result = await response.json();

      if (
        request !== quoteRequest ||
        checkIn !== selectedIn ||
        checkOut !== selectedOut
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'These dates cannot be quoted.');
      }

      const quote = result as Quote;

      totalLabel.textContent = new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: quote.currency,
      }).format(quote.total);

      nightsLabel.textContent =
        `${quote.nights} ${quote.nights === 1 ? 'night' : 'nights'}`;

      quoteStatus.textContent = 'Estimated total for your selected nights.';
      inquireButton.disabled = false;
    } catch (error) {
      if (request !== quoteRequest) return;

      totalLabel.textContent = 'Price unavailable';
      quoteStatus.textContent =
        error instanceof Error ? error.message : 'Could not check these dates.';
      inquireButton.disabled = true;
    }
  }

  function selectDate(date: string): void {
    if (!calendarReady || date < today || date > latestCheckout) return;

    if (pickerMode === 'check-in' || !checkIn) {
      if (blocked.has(date) || date >= latestCheckout) return;

      checkIn = date;
      checkOut = null;
      clearQuote();
      showSelectedDates();

      pickerMode = 'check-out';
      updatePickerButtons();
      quoteStatus.textContent = 'Now choose your check-out date.';
      drawCalendar();
      return;
    }

    if (date <= checkIn || hasBlockedNight(checkIn, date)) return;

    checkOut = date;
    clearQuote();
    showSelectedDates();
    drawCalendar();
    closeCalendar();
    checkOutButton.focus();
    void requestQuote();
  }

  async function refreshAvailability(force = false): Promise<void> {
    calendarReady = false;
    quoteRequest++;
    inquireButton.disabled = true;
    refreshButton.disabled = true;
    form.hidden = true;
    status.textContent = 'Checking Airbnb availability…';
    drawCalendar();

    try {
      const response = await fetch(
        force ? '/api/availability?refresh=1' : '/api/availability',
        { cache: 'no-store' },
      );

      if (!response.ok) throw new Error('Availability is unavailable.');

      const result = (await response.json()) as Availability;

      if (!Array.isArray(result.blockedDates)) {
        throw new Error('Availability is unavailable.');
      }

      blocked = new Set(result.blockedDates);
      calendarReady = true;

      status.textContent =
        `Last checked ${new Date(result.checkedAt).toLocaleString('en-ZA', {
          timeZone: 'Africa/Johannesburg',
          dateStyle: 'medium',
          timeStyle: 'medium',
        })}`;

      if (
        (checkIn && blocked.has(checkIn)) ||
        (checkIn && checkOut && hasBlockedNight(checkIn, checkOut))
      ) {
        checkIn = null;
        checkOut = null;
        clearQuote();
        quoteStatus.textContent =
          'Availability changed. Please choose your dates again.';
        showSelectedDates();
        pickerMode = 'check-in';
        updatePickerButtons();
      } else if (checkIn && checkOut) {
        void requestQuote();
      }

      drawCalendar();
    } catch {
      blocked.clear();
      calendarReady = false;
      checkIn = null;
      checkOut = null;
      clearQuote();
      showSelectedDates();
      pickerMode = 'check-in';
      updatePickerButtons();
      status.textContent =
        'Availability could not be checked. Please try refreshing.';
      drawCalendar();
    } finally {
      refreshButton.disabled = false;
    }
  }

  monthPair.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-date]',
    );

    if (!button || button.disabled || !calendarReady) return;

    const date = button.dataset.date;
    if (date) selectDate(date);
  });

  previousButton.addEventListener('click', () => {
    visibleMonth = new Date(
      Date.UTC(
        visibleMonth.getUTCFullYear(),
        visibleMonth.getUTCMonth() - 1,
        1,
      ),
    );
    drawCalendar();
  });

  nextButton.addEventListener('click', () => {
    visibleMonth = new Date(
      Date.UTC(
        visibleMonth.getUTCFullYear(),
        visibleMonth.getUTCMonth() + 1,
        1,
      ),
    );
    drawCalendar();
  });

  refreshButton.addEventListener('click', () => {
    void refreshAvailability(true);
  });

  checkInButton.addEventListener('click', () => {
    openCalendar('check-in', checkInButton);
  });

  checkOutButton.addEventListener('click', () => {
    openCalendar(
      checkIn ? 'check-out' : 'check-in',
      checkIn ? checkOutButton : checkInButton,
    );
  });

  viewCalendarButton.addEventListener('click', () => {
    if (!popover.hidden) {
      closeCalendar();
    } else {
      openCalendar(
        !checkIn || checkOut ? 'check-in' : 'check-out',
        viewCalendarButton,
      );
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!popover.hidden && !picker.contains(event.target as Node)) {
      closeCalendar();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popover.hidden) {
      closeCalendar();
      openingButton.focus();
    }
  });

  resetButton.addEventListener('click', () => {
    checkIn = null;
    checkOut = null;
    pickerMode = 'check-in';

    visibleMonth = new Date(
      Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1),
    );

    clearQuote();
    showSelectedDates();
    closeCalendar();
    quoteStatus.textContent = 'Choose your check-in date to start.';
    drawCalendar();
  });

  inquireButton.addEventListener('click', () => {
    if (inquireButton.disabled) return;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!checkIn || !checkOut || inquireButton.disabled) return;

    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const message = messageInput.value.trim();

    if (!email && !phone) {
      formStatus.textContent = 'Enter an email address or phone number.';
      emailInput.focus();
      return;
    }

    if (email && !emailInput.checkValidity()) {
      formStatus.textContent = 'Please enter a valid email address.';
      emailInput.focus();
      return;
    }

    if (!message) {
      formStatus.textContent = 'Please write a message.';
      messageInput.focus();
      return;
    }

    const data = new FormData(form);
    data.set('checkIn', checkIn);
    data.set('checkOut', checkOut);
    data.set('email', email);
    data.set('phone', phone);
    data.set('message', message);

    sendButton.disabled = true;
    formStatus.textContent = 'Sending your enquiry…';

    void fetch('/api/booking-inquiry', {
      method: 'POST',
      body: data,
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Your enquiry could not be sent.');
        }

        formStatus.textContent =
          'Enquiry sent. We will contact you to confirm availability.';
        sendButton.disabled = true;
      })
      .catch((error: unknown) => {
        formStatus.textContent =
          error instanceof Error
            ? error.message
            : 'Your enquiry could not be sent. Please try again.';
        sendButton.disabled = false;
      });
  });

  showSelectedDates();
  updatePickerButtons();
  quoteStatus.textContent = 'Choose your check-in date to start.';
  drawCalendar();
  void refreshAvailability();
}

setupCalendar();