// Interactive Map
var svgContainer = document.getElementById('svg-container');
var svgElement;

const infoContainer = document.getElementById('interactive-map-info-container');
const info = document.getElementById('interactive-map-info');

// Header Elements
const buttonLoadMap = document.getElementById("buttonLoadMap");
const showOptionsContainer = document.getElementById("show-options-container");
const showOptions = document.querySelectorAll('.show-option')

const showSectorsRadioButton = document.getElementById("show-sectors");

const buttonOptions = document.getElementById("button-options");
const searcher = document.getElementById("searcher");

const selector = document.getElementById('selector');

// Panzoom 
const panzoomGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
var pz;
 // Other variables
var allRoads;

// General functions
function notify(msg, color = "transparent"){
    info.innerText= msg;
    infoContainer.style.background = color;
}

function extractAllRoads(data) {
    const allRoads = [];

    function search(node) {
        if (Array.isArray(node)) {
            node.forEach(item => search(item));
        } else if (typeof node === 'object' && node !== null) {
            // Si el objeto tiene propiedades de una calle (ej: 'id', 'name', 'points'), lo consideramos una calle
            if (node.id !== undefined && node.name !== undefined && node.points !== undefined) {
                allRoads.push(node);
            }
            // Buscar recursivamente en todas las propiedades del objeto
            Object.values(node).forEach(value => search(value));
        }
    }

    search(data);
    return allRoads;
}

function loadSelector(){
    selector.innerHTML = '<option value="">Seleccione</option>';
    
    radioButtons = Array.from(selector); // Convierte de NodeList a array
        
    let sortered = allRoads.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    sortered.forEach(road => {
        const option = document.createElement('option');
        option.value = road.id;
        option.textContent = road.name;
        selector.appendChild(option);
    });  
    
    dataParcels.forEach(point => {
        const option = document.createElement('option');
        option.value = point.id;
        option.textContent = point.id;
        selector.appendChild(option);
    });
}

function moveToSelectorValue() {
    svgElement.querySelectorAll('.road').forEach(el => {        
        el.classList.remove('road-highlight');
    });

     svgElement.querySelectorAll('.parcel').forEach(el => {        
        if (!el.classList.contains('hidden')) el.classList.add('hidden');
    });
    
    let id = selector.value;
    if (!id) { return;}

    let point = undefined; 
    let road = allRoads.find(r => r.id == id);

    if (road){
        point = {
            id:id,
            x: road.points[0].x,
            y: road.points[0].y,
            duration: 3000,
            width: 40,
            height: 40
        };

        svgElement.getElementById(point.id).classList.add('road-highlight'); 
    }
    else {
        let parcel = dataParcels.find(p => p.id == id);
        if (parcel) {
            point = {
                id: parcel.id,
                x: parcel.x,
                y: parcel.y,
                duration: 3000,
                width: 40,
                height: 40
            };
        }
        svgElement.getElementById(point.id).classList.remove('hidden'); 
    }
        
    if (!point) return;

    radioAllStreet = document.getElementById("show-all-street")
    
    if (!radioAllStreet.checked)
    {
        radioAllStreet.checked = true;
        radioAllStreet.dispatchEvent(new Event('change'));
    }

    moveToPoint(point);
}

function createPolygon(points, color = 'rgba(52, 152, 219, 0.5)') {
    const svgNS = 'http://www.w3.org/2000/svg';
    const polygon = document.createElementNS(svgNS, 'polygon');

    // Convertir coordenadas a string de puntos SVG
    const polygonPoints = points.map(c => `${c.x},${c.y}`).join(' ');
    polygon.setAttribute('points', polygonPoints );

    // Estilo del polígono
    polygon.setAttribute('fill', color);
    polygon.setAttribute('stroke', color.replace('0.5)', '1)'));
    polygon.setAttribute('stroke-width', '2');
    polygon.setAttribute('stroke-linejoin', 'round');
    return polygon;
}
//
/**
 * Dibuja líneas conectando puntos en un SVG con Panzoom
 * @param {Array} puntos - Array de objetos {x, y}
 * @param {string} color - Color CSS (ej: "#ff0000", "rgba(0,0,255,0.5)")
 * @param {Object} opciones - Configuración adicional:
 *        {
 *          grosor: 2,          // Grosor de línea
 *          cerrado: false,     // Conectar último punto con el primero
 *          punteado: false,    // Línea punteada
 *          id: null,           // ID para el elemento
 *          clase: null,        // Clase CSS
 *          name: null          // Nombre de la linea
 *        }
 * @returns {SVGPolylineElement} El elemento creado
 */
function createPolyline(puntos, color = '#3388ff', opciones = {}) {
    const svgNS = 'http://www.w3.org/2000/svg';

    // Crear elemento (polyline para líneas conectadas)
    const polyline = document.createElementNS(svgNS, 'polyline');

    // Convertir puntos a string de coordenadas
    const puntosStr = puntos.map(p => `${p.x},${p.y}`).join(' ');
    polyline.setAttribute('points', puntosStr);

    // Estilo básico
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', opciones.grosor || 2);

    // Opciones avanzadas
    if (opciones.cerrado) {
        polyline.setAttribute('points', puntosStr + ` ${puntos[0].x},${puntos[0].y}`);
    }

    if (opciones.punteado) {
        polyline.setAttribute('stroke-dasharray', '5,3');
    }

    if (opciones.id) {
        polyline.setAttribute('id', opciones.id);
    }

    if (opciones.clase) {
        polyline.setAttribute('class', opciones.clase);
    }

    return polyline;
}

function createCircle(point, color, r) {    
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', point.x);
    marker.setAttribute('cy', point.y);
    marker.setAttribute('r', r);
    marker.setAttribute('fill', color);
    marker.setAttribute('data-coords', `${point.x.toFixed(2)},${point.y.toFixed(2)}`);
    return marker;
}

function moveToPoint(point) {
    const transform = pz.getTransform();
    const svgRect = svgElement.getBoundingClientRect();

    const centerX = point.x + point.width / 2;
    const centerY = point.y + point.height / 2;

    const targetX = (svgRect.width / 2) - (centerX * transform.scale);
    const targetY = (svgRect.height / 2) - (centerY * transform.scale);

    pz.smoothMoveTo(targetX, targetY, point.duration);
}

function setZoom(level) {
    if (!pz) return;
    const centerX = svgContainer.clientWidth / 2;
    const centerY = svgContainer.clientHeight / 2;
    pz.smoothZoomAbs(centerX, centerY, level);
}

function resizeSVG() {
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
}

// Load map
document.getElementById('buttonLoadMap').addEventListener('click', function() {
    const svgUrl = "https://media.githubusercontent.com/media/DonBastian/website/1585307b1d7c643cf8f17b321765efe51f22c2e4/_source/images/PlanoHdb.svg";
    
    buttonLoadMap.disabled=true;

    notify("Inicializando Mapa: Esta operación puede tardar unos segundos...");
        
    fetch(svgUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al descargar el archivo');
            }
            return response.text();
        })
        .then(svgContent => {                    
            svgContainer.innerHTML = svgContent; 
            svgElement = svgContainer.querySelector('svg');

            notify("Ya casí estamos terminando...", "green");
            
            // Load filter
            let defs = svgElement.querySelector('defs');

            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.setAttribute('id', 'resplandor-dorado');
            filter.setAttribute('x', '-50%');
            filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%');
            filter.setAttribute('height', '200%');

            const steps = [
                // Paso 1: Desenfoque
                `<feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />`,

                // Paso 2: Color dorado
                `<feFlood flood-color="gold" flood-opacity="0.9" result="gold" />`,
                `<feComposite in="gold" in2="blur" operator="in" result="glow" />`,

                // Paso 3: Superponer brillo (2 veces)
                `<feComposite in="glow" in2="SourceGraphic" operator="over" result="glow1" />`,
                `<feComposite in="glow" in2="glow1" operator="over" result="glow2" />`,

                // Paso 4: Línea original + brillo
                `<feMerge>
                    <feMergeNode in="glow2" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>`
            ];

            filter.innerHTML = steps.join('');

            defs.appendChild(filter);
            
            // Load panzoom
            panzoomGroup.id = 'panzoom-group';

            while (svgElement.firstChild) {
                panzoomGroup.appendChild(svgElement.firstChild);
            }
            svgElement.appendChild(panzoomGroup);
        
            pz = panzoom(panzoomGroup, {
                startScale: 0.20,   
                startX: 1532,      
                startY: 2128,  
                maxZoom: 1.20,
                minZoom: 0.20,
                bounds: true,
                beforeWheel: function(e) {
                    e.preventDefault(); 
                    e.stopPropagation();
                    return false;
                }
            });

            pz.off("wheel");

            // Bloqueos nucleares.
            svgContainer.addEventListener('wheel', (e) => {
              e.preventDefault();
              e.stopImmediatePropagation();
            }, { passive: false, capture: true });
        
            svgContainer.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              e.stopImmediatePropagation();
            }, { capture: true, passive: false });

            svgContainer.addEventListener('auxclick', (e) => {
              if (e.button === 1) { // El botón central es `1`
                e.preventDefault();
                e.stopImmediatePropagation();
              }
            }, { capture: true, passive: false });

            svgContainer.addEventListener('mousedown', (e) => {
              if (e.button === 1 || e.button === 2) { // 1 = rueda, 2 = derecho
                e.preventDefault();
                e.stopImmediatePropagation();
              }
            }, { capture: true, passive: false });

            svgContainer.style.cursor="move";

            // Load sectors data
            let sectors = [];
            sectors.push(createPolygon(sector0, 'rgba(153, 102, 255, 0.5)')); 
            sectors.push(createPolygon(sector1, 'rgba(0, 150, 136, 0.5)'));  
            sectors.push(createPolygon(sector2, 'rgba(255, 61, 113, 0.5)')); 
            sectors.push(createPolygon(sector3, 'rgba(52, 168, 83, 0.5)'));  
            sectors.push(createPolygon(sector4, 'rgba(234, 67, 53, 0.5)'));  
            sectors.push(createPolygon(sector5, 'rgba(66, 133, 244, 0.5)')); 
            sectors.push(createPolygon(sector6, 'rgba(244, 180, 0, 0.5)'));  
            sectors.push(createPolygon(sector7, 'rgba(0, 191, 165, 0.5)'));  
            sectors.push(createPolygon(sector8, 'rgba(255, 87, 34, 0.5)'));  
            sectors.push(createPolygon(sector9, 'rgba(7, 255, 243, 0.5)'));  
            sectors.push(createPolygon(sector10, 'rgba(255, 193, 7, 0.5)'));

            sectors.forEach(sector => {
                sector.classList.add("sector");
                sector.classList.add("hidden");
            
                panzoomGroup.appendChild(sector);
            });

            // Load roads data
            // Dibujar todas las calles encontradas
            allRoads = extractAllRoads(dataRoads);

            allRoads.forEach(street => {
            
                let polyline = createPolyline(street.points, street.color, {
                    grosor: street.grossor || 6,
                    cerrado: false,
                    punteado: street.dotted || false,
                    id: street.id || null,
                    clase: street.class || 'street',
                    name: street.name || none
                });
            
                // Hacer interactivo
                polyline.style.cursor = 'pointer';
            
                polyline.style.strokeLinecap = 'round'; 
                polyline.style.strokeLinejoin = 'round';
            
                if (polyline.classList.contains("passage") | polyline.classList.contains("local-street") ){
                    polyline.classList.add("hidden");
                }
            
                polyline.addEventListener('mouseover', (e) => {
                    e.stopPropagation();  
                    notify(`${street.id} - ${street.name.toUpperCase()}`);            
                });

                polyline.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log(`${street.id} - ${street.name} `, street.points);
                });
            
                // Agregar al grupo de Panzoom
                panzoomGroup.appendChild(polyline);
            });

            // Load parcels data
            dataParcels.forEach(point => {
                let circle = createCircle(point, 'rgba(255, 0, 0, 1)', 20);
                circle.classList.add("parcel");
                circle.classList.add("hidden");
                circle.setAttribute('id', point.id);
                
                // Hacer interactivo
                circle.style.cursor = 'all-scroll';            

                panzoomGroup.appendChild(circle);
            });
           
            // Add events
            window.addEventListener('resize', resizeSVG);

            showOptions.forEach( radio => {
                radio.addEventListener('change', function(){
                    if (radio.id === "show-all-street"){                        
                        svgElement.querySelectorAll(".passage").forEach(passage => passage.classList.remove("hidden"));
                        svgElement.querySelectorAll(".local-street").forEach(localStreet => localStreet.classList.remove("hidden"));
                    }
                    else if (radio.id === "show-principals"){                        
                        svgElement.querySelectorAll(".passage").forEach(passage => passage.classList.add("hidden"));
                        svgElement.querySelectorAll(".local-street").forEach(localStreet => localStreet.classList.add("hidden"));                        
                    }
                });
            });

            showSectorsRadioButton.addEventListener('change', function() {
                if (showSectorsRadioButton.checked) {           
                    svgElement.querySelectorAll(".sector").forEach(sector => sector.classList.remove("hidden"));
                }   
                else {
                    svgElement.querySelectorAll(".sector").forEach(sector => sector.classList.add("hidden"));
                }   
            });

            selector.addEventListener('change', function (e) {
                moveToSelectorValue();
            });

            // Finally
            buttonLoadMap.classList.add("hidden");
            showOptionsContainer.classList.remove("hidden");
            buttonOptions.classList.remove("hidden");
            searcher.classList.remove("hidden");            
            resizeSVG();

            loadSelector(); 

            setZoom(0.25);
            
            notify("Enhorabuena, ya puedes usar el selector para buscar vías o parcelas.", "#b5f5b5");
        })
        .catch(error => {
            notify(`Error: ${error.message}`, "red");
            console.error('Error:', error);
            buttonLoadMap.disabled = false;
        });
});
