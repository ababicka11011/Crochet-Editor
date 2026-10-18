# Risk Register & Contingency Plans

**Engineering / Master's Degree Project – Faculty of MIS, WUT**

---

## 1. Project and Technical Risk Register

Prawdopodobieństwo i wpływ są mierzone w skali 1-3, gdzie 1 oznacza małe prawdopodobieństwo wystąpienia/wpływ, a 3 - duże.

|        ID        | Ryzyko                                                   | Prawdopodobieństwo | Wpływ  |  Owner  | Mitygacja                                                                                                                |
| :--------------: | :----------------------------------------------------------- | :----------------: | :-----------------: | :------: | :---------------------------------------------------------------------------------------------------------------------------------- |
| **RSK-01** | **układy zwracane przez algorytm są poprawne matematycznie, ale "krzywe" wizualnie** |         3         |          3          | Anna Babicka | Stworzenie wczesnego prototyp na d3-force, aby zidentyfikować możliwe problemy, Metryki estetyczne do określenia liczbowego jakości wyniku algorytmu, Sensowne rozmieszczenie początkowe symboli. |
| **RSK-02** | **Niedoszacowanie złożoności algorytmu (ograniczenia, stress)** |         3         |          3          |  Anna Babicka  | Iteracje algorytmu: najpierw wersja prosta, potem nakładanie kolejnych ograniczeń z ewaluacją ich wpływu na layout; Ustalenie konkretnego okna czasowego na badania - po skończeniu należy podjąć decyzję co do używanej wersji algorytmu |
| **RSK-03** | **Brak wiarygodnych danych o geometrii oczek** |         2         |          2          | David Z. | Proporcje oczek oparte na pomiarach z literatury; wartości, dla których brak danych pomiarowych, oznaczone jako założenia projektowe, Wprowadzenie trybu kalibracji, w którym użytkownik może wprowadzić własne proporcje zmierzone na podstawie próbki. |
| **RSK-04** | **Niewystarczająca wydajność dla dużych wzorów** |         2         |        2        | Anna Babicka | Przeniesienie zadania wyliczania algorytmów do Web Workera, Benchmarki od początku dla każdej wersji, React.memo do renderowania tylko przesuniętych elementów zamiast całego wzoru po każdej zmianie. |
| **RSK-05** | **Problemy z integracją modułu algorytmicznego i edytora**   |         2         |        3       | Wszyscy | Wczesne zdefiniowanie interfejsu komunikacji między modułami, Ustalenie wspólnych typów, Testy kontraktowe |
| **RSK-06** | **Rozrost zakresu (scope creep), czyli funkcje opcjonalne kosztem MVP** |         3         |          2          | Anna Babicka | Ścisła priorytetyzacja MVP, Funkcje opcjonalne dopiero po jego ukończeniu. |
| **RSK-07** | **Nierównomierne obciążenie lub niedostępność jednej osoby w parze** |         2         |          3          | Wszyscy | Jasny podział zadań, Regularne spotkania z ewaluacją progresu względem planu, Wspólne repozytorium i code review. |
| **RSK-08** | **Rozbieżności w sposobie działania między przeglądarkami**    |         1         |          2          | Wiktor Murawski | Używanie sprawdzonych bibliotek kompatybilnych z różnymi przeglądarkami, testy na wielu przeglądarkach. |
| **RSK-09** | **Niedotrzymanie harmonogramu (sesja, inne przedmioty)**    |         3         |          2          | Wszyscy | Kamienie milowe z buforem czasowym, wczesne MVP. |
| **RSK-10** | **Nagromadzenie pracy związanej z pisaniem pracy dyplomowej w styczniu**    |         3         |          3          | Wszyscy | Dokumentacja użytych rozwiązań na bieżąco w celu stworzenia szkicu pracy przed 12 tygodniem. |
| **RSK-11** | **Promotor/recenzent nie będzie w stanie ocenić aplikacji ze względu na brak wiedzy o szydełkowaniu**    |         3         |          1          | Wszyscy | Przygotowanie instrukcji użytkownika z przykładami do odtworzenia, Przygotowanie filmu prezentującego tworzenie wzoru, Znalezienie osoby szydełkującej, która będzie w stanie ocenić rzeczywistą przydatność aplikacji. |


---

## 2. Contingency Plans for High-Risk Modules (Plan B Protocols)

### Contingency Protocol 1: Jakość wizualna układu

* **Plan A (Primary):** Układ promienisty lub prostokątny, w zależności od typu rozpoczęcia, jako start plus optymalizacja algorytmem.
* **Plan B Trigger:** Metryki estetyczne przekraczają ustalone progi na wzorach testowych, albo schematy są oceniane jako nieczytelne podczas przeglądu.
* **Plan B (Contingency):** Skupienie na implementacji funkcji wprowadzania ręcznych poprawek przez użytkownika. Ta funkcja jest opcjonalna i w tej sytuacji przechodzi do MVP.

### Contingency Protocol 2: Algorytm rozmieszczania (ograniczenia geometryczne)

* **Plan A (Primary):** Implentacja algorytmu stress majorization z twardymi ograniczeniami (proporcje H/W, brak nakładania), np. przez WebCola lub własną implementację.
* **Plan B Trigger:** Po upływie okna czasowego (np. 2 tygodnie) algorytm nie spełnia kryterium sukcesu, np. występują nakładania lub proporcje poza granicami dla znaczącej liczby przypadków, albo implementacja nie jest ukończona.
* **Plan B (Contingency):** Zmiana algorytmu na d3-force z miękkimi siłami (długości krawędzi, siła radialna, kolizje).

### Contingency Protocol 3: Integracja algorytmu z edytorem

* **Plan A (Primary):** Wspólny interfejs używany przez oba moduły, wspólne typy TypeScript, layout liczony w Web Workerze.
* **Plan B Trigger:** Do ustalonego kamienia milowego (np. koniec 6. tygodnia) edytor nie wyświetla układu z modułu algorytmicznego od początku do końca, albo komunikacja z Workerem powoduje błędy, których nie da się szybko naprawić.
* **Plan B (Contingency):** Layout liczony synchronicznie w głównym wątku, a do czasu naprawy integracji edytor korzysta z atrapy layoutu, żeby prace nad UI nie stały.


### Contingency Protocol 4: Wydajność przy dużych wzorach

* **Plan A (Primary):** Przeliczanie całego wzoru za każdym razem w Web Workerze i React.memo dla symboli.
* **Plan B Trigger:** Dla wzoru 500 oczek przeliczenie trwa ponad 2 s (p95) albo interfejs spada poniżej 30 FPS. 
* **Plan B (Contingency):** Przeliczanie wyłącznie zmienionego okrążenia i jego sąsiadów, a w ostateczności ograniczenie obsługiwanego rozmiaru wzoru w dokumentacji.

### Contingency Protocol 5: Dane o geometrii oczek

* **Plan A (Primary):** Użycie wartości z literatury tam, gdzie są dostępne, z oznaczeniem źródła, oraz założenia projektowe dla pozostałych typów.
* **Plan B Trigger:** Proporcje oparte na założeniach dają wizualnie nierealistyczne schematy, albo promotor lub recenzent zakwestionuje brak danych dla SC i HDC.
* **Plan B (Contingency):** Własne pomiary próbek (np. 10×10) dla brakujących typów oczek, a jeśli starczy czasu, tryb kalibracji użytkownika.
