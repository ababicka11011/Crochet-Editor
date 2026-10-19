# Team Charter and Responsibility Assignment Matrix (RACI)

**Projekt inżynierski dyplomowy – Wydział Matematyki i Nauk Informacyjnych Politechniki Warszawskiej**

---

## 1. Informacje o projekcie

* **Tytuł:** *Edytor schematów szydełkowych z automatycznym rozmieszczaniem symboli*
* **Zespół:**
  * **Anna Babicka** – `anna.babicka.stud@pw.edu.pl`
  * **Wiktor Murawski** – `wiktor.murawski.stud@pw.edu.pl`
* **Promotor:** dr inż. Paweł Kotowski
* **Prowadzący laboratorium:** ?
* **Repozytorium:** `https://github.com/ababicka11011/Crochet-Editor`

---

## 2. Communication Rules and Tools

* **Kanał główny komunikacji:** (do ustalenia) (response time on business days $\le 24$h).
* **Cotygodniowe spotkanie:** stały termin, 30–45 min, oparte na raportach tygodniowych. Agenda: postęp, blokery, decyzje, plan na kolejny tydzień.
* **Spotkania z promotorem:** (terminy i częstotliwość do ustalenia), przygotowujemy wspólnie listę pytań i stan prac. Po spotkaniu jedna osoba (rotacyjnie) spisuje ustalenia w ciągu 24 h.
* **Zarządzanie zadaniami:** wszystkie zadania są w jednym narzędziu (do ustalenia) ze statusem i terminem. Zadanie bez issue nie istnieje.
* **Kontrakt między modułami:** zmiany we wspólnych typach i interfejsach wymagają zgody obu osób, wyrażonej w PR lub issue.
* **Decyzje projektowe:** Decyzje projektowe zapisujemy w repozytorium (`docs/decisions.md`) lub w issue, a nie tylko w czacie. Ważne decyzje techniczne zapisujemy krótko: kontekst, decyzja, uzasadnienie.
* **Gałęzie:** `main` jest zawsze działający. Pracujemy na gałęziach `feature/...` i `fix/...`.
* **Pull requesty:** każda zmiana trafia do main przez PR z co najmniej jednym review drugiej osoby. Review wykonujemy w ciągu 48 h.
* **Jakość:** PR musi przechodzić lint, kompilację TypeScript i testy w CI.
* **Commity:** opisowe wiadomości, np. w konwencji Conventional Commits (feat:, fix:, docs:).
* **Tekst pracy:** każda osoba pisze swoje rozdziały, a druga je czyta i komentuje przed oddaniem promotorowi.
* **Różnica zdań:** każda strona przedstawia argumenty, a decyzję podejmujemy na podstawie danych (prototyp, pomiar, literatura). Jeśli nie dochodzimy do porozumienia w ciągu tygodnia, sprawę konsultujemy z promotorem.

Wzór raportu cotygodniowego jest w [`week-raport.md`](week-raport.md). Każda osoba wypełnia je osobno i przedstawia na cotygodniowym spotkaniu.
<!-- Nie jest to oficjalne wymaganie, ale myślę, że warto to dodać, żeby wiedzieć, co przegadać na spotkaniu. -->

---

## 3. Responsibility Assignment Matrix (RACI Matrix)

Definicje ról:

* **R (Responsible):** Osoba wykonująca zadanie (bezpośredni autor kodu / dokumentacji).
* **A (Accountable):** Osoba ponosząca ostateczną odpowiedzialność za jakość wyników i dotrzymanie terminów (**dokładnie 1 osoba na każde zadanie!**).
* **C (Consulted):** Ekspert merytoryczny, z którym konsultowano kwestie techniczne i który dokonał przeglądu.
* **I (Informed):** Osoba na bieżąco informowana o postępach i ostatecznych decyzjach.

| Zadanie  |      Anna      |       Wiktor       |      Promotor      | 
| :------------------------------------------------------------------- | :-------------: | :-------------: | :-------------: |
| **Cel, zakres, MVP, wymagania, harmonogram, zarządzanie ryzykiem (Etap 1)**                    |   **A**   |        R        |        C        |
| **Projekt architektury i interfejsów (Etap 2)**            | **A / R** |        R        |        C        |
| **Przegląd literatury i dane o geometrii oczek (Etap 2)**                    |        **A / R**        | C |        I        |
| **Model danych i operacje na grafie (Etap 2)**         |        **A / R**        |        C        |        C        |
| **Algorytm rozmieszczania i metryki estetyczne (Etap 2)**                |        **A / R**        |        I        | C |
| **Projekt UX/UI (Etap 2)** |        C        |        **A / R**        |        I        |
| **Implementacja edytora (SVG, interakcje, undo/redo) (Etap 3)**         |        C        |        **A / R**        |        -        |
| **Testy automatyczne i code review (Etap 3)**    |   R   |        **A / R**        |        C        |
| **Integracja modułu algorytmicznego z edytorem (Etap 4)**    |  **A / R** | R   |       -         |
| **Ewaluacja algorytmu (Etap 4)**    |   **A / R**   |        C        |        C        |
| **Implementacja dodatkowych funkcjonalności (Etap 5)**    |   R   |        A        |        C        |
| **Praca pisemna: wstęp, przegląd literatury, użyte algorytmy, model danych (Etap 6)**     | **A / R** |        R        |        C        |
| **Praca pisemna: architektura rozwiązania, implementacja, wyniki (Etap 6)** |   R   | **A / R** |        C        |
| **Praca pisemna: Redakcja i zatwierdzenie całości (Etap 6)** |        R        |        R        |        **A**        |

---

## 4. Free-Rider Escalation Protocol

Aby chronić cały zespół przed negatywnymi konsekwencjami wynikającymi z braku zaangażowania któregokolwiek z członków, ustanawia się trzyetapowy protokół:

1. **Etap I (tygodnie 1–4, wewnętrzne ostrzeżenie dla zespołu):**
   * Jeśli członek zespołu nie wykona przydzielonych zadań w ciągu dwóch kolejnych sprintów lub opuści cotygodniowe spotkania, kierownik zwołuje specjalne spotkanie indywidualne.
   * Uzgadniany jest 7-dniowy plan naprawczy, który jest dokumentowany w systemie śledzenia problemów (Issue Tracker).
2. **Etap II (tygodnie 4–6, powiadomienie przełożonego):**
   * Jeśli wyniki nie ulegną poprawie, podczas kolejnej konsultacji promotor zostaje formalnie powiadomiony o opóźnieniach na ścieżce krytycznej spowodowanych brakiem wkładu danej osoby.
3. **Etap III (tygodnie 6–8, formalne zgłoszenie do instruktora laboratorium):**
   * Przed zakończeniem etapu III sprawa zostaje oficjalnie zgłoszona do instruktora laboratorium wraz z wnioskiem o zróżnicowanie oceny lub wykluczenie studenta z zespołu przed obroną.
   * **Kluczowa zasada:** Zgłaszanie tej kwestii w późnym terminie, w tygodniach 12–15, jest absolutnie niedopuszczalne.


---

## 5. Team Member Signatures

* Anna Babicka: .................................................... Date: Oct 02, 2026
* Wiktor Murawski: ........................................................... Date: Oct 02, 2026
